import {validateAccountSave} from './account-storage.mjs';

const table = 'art_atlas_account_saves';
const columns = 'kind,revision,updated_at';
const changed = () => Error('The account save changed on another device. Review the latest version and try again.');

export function createAccountDatabase(client) {
  async function list(ownerId) {
    const {data, error} = await client.from(table).select(columns).eq('owner_id', ownerId);
    if (error) throw Error('Your account saves could not be loaded.');
    return data;
  }

  async function open(ownerId, kind, revision) {
    const {data, error} = await client.from(table).select('snapshot').eq('owner_id', ownerId).eq('kind', kind).eq('revision', revision).maybeSingle();
    if (error) throw Error('That account save could not be loaded.');
    if (!data) throw changed();
    return validateAccountSave(kind, data.snapshot);
  }

  async function save(ownerId, kind, snapshot, revision) {
    validateAccountSave(kind, snapshot);
    const write = revision === null
      ? client.from(table).insert({owner_id:ownerId, kind, snapshot})
      : client.from(table).update({snapshot}).eq('owner_id', ownerId).eq('kind', kind).eq('revision', revision);
    const {data, error} = await write.select(columns).maybeSingle();
    if (error?.code === '23505' || !error && !data) throw changed();
    if (error) throw Error('That account save could not be written.');
    return data;
  }

  async function remove(ownerId, kind, revision) {
    const {data, error} = await client.from(table).delete().eq('owner_id', ownerId).eq('kind', kind).eq('revision', revision).select('kind').maybeSingle();
    if (error) throw Error('That account save could not be removed.');
    if (!data) throw changed();
  }

  return {list, open, save, remove};
}
