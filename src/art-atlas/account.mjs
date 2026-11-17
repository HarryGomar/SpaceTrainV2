import {createClient} from '@supabase/supabase-js';
import {accountSaveSummary, accountSaveTypes, createDeviceAccountSaves} from './account-storage.mjs';
import {createAccountDatabase} from './account-database.mjs';

const signIn = document.querySelector('#sign-in');
const signOut = document.querySelector('#sign-out');
const signedIn = document.querySelector('#signed-in');
const status = document.querySelector('#account-status');
const identity = document.querySelector('#identity');
const saves = document.querySelector('#saves');
const template = document.querySelector('#save-row');
const showStatus = text => { status.textContent = text; };

const settings = __ART_ATLAS_PUBLIC_CONFIG__;
if (settings) {
  start(settings);
} else {
  showStatus('Account saves are unavailable right now.');
}

function start({url, publishableKey}) {
  const client = createClient(url, publishableKey, {auth:{
    flowType:'pkce',
    storageKey:'art-atlas-account-auth-v1:'+new URL(url).host,
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true
  }});
  const database = createAccountDatabase(client);
  const device = createDeviceAccountSaves();
  let user = null;
  let generation = 0;
  let busy = false;

  async function renderSaves(owner) {
    const view = ++generation;
    const results = await Promise.allSettled([
      database.list(owner.id),
      Promise.all(accountSaveTypes.map(async type => {
        const [local, previous] = await Promise.allSettled([device.capture(type.id), device.recovery(owner.id, type.id)]);
        return {type, local, previous};
      }))
    ]);
    if (view !== generation || user?.id !== owner.id) return;
    saves.replaceChildren();
    const [cloud, local] = results;
    if (cloud.status === 'rejected') {
      showStatus('Your account saves could not be loaded. Reload to try again.');
      return;
    }
    const remoteByKind = new Map(cloud.value.map(row => [row.kind, row]));
    for (const {type, local:deviceSave, previous} of local.value) {
      const row = template.content.firstElementChild.cloneNode(true);
      const accountSave = remoteByKind.get(type.id);
      const localCopy = deviceSave.status === 'fulfilled' ? deviceSave.value : null;
      const prior = previous.status === 'fulfilled' ? previous.value : null;
      row.querySelector('h2').textContent = type.label;
      row.querySelector('[data-device]').textContent = deviceSave.status === 'fulfilled'
        ? 'On this device · ' + accountSaveSummary(localCopy)
        : 'The copy on this device could not be read.';
      row.querySelector('[data-account]').textContent = accountSave
        ? 'Saved to account · ' + new Date(accountSave.updated_at).toLocaleString()
        : 'No account save yet';
      const open = row.querySelector('[data-open]');
      open.href = type.href;
      open.textContent = 'Open ' + type.label.toLowerCase();
      const saveButton = row.querySelector('[data-save]');
      saveButton.disabled = !localCopy;
      saveButton.textContent = accountSave ? 'Replace account save' : 'Save to account';
      saveButton.setAttribute('aria-label', (accountSave ? 'Replace account save for ' : 'Save to account · ') + type.label);
      saveButton.addEventListener('click', () => operate(owner, async () => {
        const fresh = await device.capture(type.id);
        if (!fresh) throw Error('There is nothing to save from this device.');
        await database.save(owner.id, type.id, fresh, accountSave?.revision ?? null);
        return type.label + ' saved to your account.';
      }));
      const restore = row.querySelector('[data-restore]');
      restore.hidden = !accountSave;
      restore.setAttribute('aria-label', 'Restore here · ' + type.label);
      restore.addEventListener('click', () => operate(owner, async () => {
        const snapshot = await database.open(owner.id, type.id, accountSave.revision);
        if (user?.id !== owner.id) throw Error('This account signed out before the save could be restored.');
        const result = await device.restore(owner.id, type.id, snapshot);
        return result.previous ? 'Restored to this device. Your previous copy is available below.' : 'Restored to this device.';
      }));
      const recover = row.querySelector('[data-recover]');
      recover.hidden = !prior;
      recover.addEventListener('click', () => operate(owner, async () => {
        const snapshot = await device.recovery(owner.id, type.id);
        if (!snapshot) throw Error('The previous device copy is unavailable.');
        await device.restore(owner.id, type.id, snapshot);
        return 'Previous device copy restored.';
      }));
      const remove = row.querySelector('[data-remove]');
      remove.hidden = !accountSave;
      remove.addEventListener('click', () => {
        if (window.confirm('Remove the account save for ' + type.label.toLowerCase() + '?')) {
          void operate(owner, async () => {
            await database.remove(owner.id, type.id, accountSave.revision);
            return 'Account save removed.';
          });
        }
      });
      saves.append(row);
    }
  }

  async function operate(owner, action) {
    if (busy || user?.id !== owner.id) return;
    busy = true;
    signOut.disabled = true;
    signedIn.setAttribute('aria-busy', 'true');
    for (const button of saves.querySelectorAll('button')) button.disabled = true;
    showStatus('Working…');
    try {
      const message = await action();
      if (user?.id === owner.id) showStatus(message);
    } catch (error) {
      if (user?.id === owner.id) showStatus(error?.message || 'The change could not be saved.');
    } finally {
      busy = false;
      signOut.disabled = false;
      signedIn.removeAttribute('aria-busy');
      if (user?.id === owner.id) await renderSaves(owner);
    }
  }

  function showUser(session) {
    const currentUser = session?.user || null;
    if (currentUser?.id === user?.id && signedIn.hidden === !currentUser && signIn.hidden === !!currentUser) return;
    user = currentUser;
    generation++;
    saves.replaceChildren();
    identity.textContent = user?.email || '';
    signOut.hidden = !user;
    signedIn.hidden = !user;
    signIn.hidden = !!user;
    showStatus('');
    if (user) void renderSaves(user);
  }

  // Running outside the auth callback keeps account queries out of the auth lock.
  client.auth.onAuthStateChange((event, session) => {
    if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT'].includes(event)) setTimeout(() => showUser(session), 0);
  });

  signIn.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = signIn.querySelector('button');
    submit.disabled = true;
    try {
      const email = signIn.elements.email.value.trim();
      const emailRedirectTo = new URL('./account.html', location.href).href;
      const {error} = await client.auth.signInWithOtp({email, options:{emailRedirectTo}});
      showStatus(error ? 'The link could not be sent. Check your address and try again.' : 'Check your email for a sign-in link. Open it in this browser.');
    } catch {
      showStatus('The sign-in service could not be reached.');
    } finally {
      submit.disabled = false;
    }
  });

  signOut.addEventListener('click', async () => {
    const {error} = await client.auth.signOut({scope:'local'});
    if (error) showStatus('You could not be signed out. Try again.');
  });
}
