import React, {useEffect, useRef, useState} from 'react';
import {Link, useLocation, useNavigate, useParams} from 'react-router-dom';
import {profile} from '../../data/profile';
import {canonicalProjectId} from '../../data/projectAliases';
import {homeProjects, projectInTopic, relatedRecords, topicNames, topics} from './homeProjects';
import HomeProjectMap from './HomeProjectMap';
import './Home.css';

const images = [
    {src:'/home/clusters-overview.png',title:'Point-cloud study',alt:'Four colored point clusters with different shapes and densities'},
    {src:'/ProjectImages/UOL.png',title:'Universo de Leyes',alt:'Violet point-cloud visualization from the Universo de Leyes project'},
];
const CvLink = () => <a className="home-link home-cv" href="/home/harry-gomar-cv.pdf" download="Rafael Harry Gomar Dawson - CV.pdf">CV <span>PDF</span></a>;
const EmailLink = () => <a className="home-link home-email" href={`mailto:${profile.email}`}>{profile.email}</a>;

const Row=({label,className='',children,...rest})=> <section className={'home-row '+className} {...rest}><h2 className="home-row-label">{label}</h2><div className="home-row-body">{children}</div></section>;

function Description({text}) {
    return text.split(/\n\s*\n/).map((block,i) => {
        const lines=block.split('\n');
        const listStart=lines.findIndex(line=>line.trim().startsWith('- '));
        return listStart<0 ? <p key={i}>{block}</p> : <div key={i}>{listStart>0&&<p>{lines.slice(0,listStart).join(' ')}</p>}<ul>{lines.slice(listStart).map((line,j)=><li key={j}>{line.replace(/^\s*-\s*/,'')}</li>)}</ul></div>;
    });
}

export default function Home() {
    const [highlight,setHighlight]=useState(null);
    const [pinned,setPinned]=useState(null);
    const selection=highlight??pinned;
    const pin=next=>{setPinned(current=>current?.kind===next.kind&&current.id===next.id?null:next);setHighlight(null);};
    const [extraDialog,setExtraDialog]=useState(null);
    const [archiveOpen,setArchiveOpen]=useState(false);
    const dialogRef=useRef(null);
    const archiveRef=useRef(null);
    const navigate=useNavigate();
    const location=useLocation();
    const {id}=useParams();
    const selectedProject=id ? homeProjects.find(project=>project.id===canonicalProjectId(id)) : null;
    const selectedTalk=extraDialog?.type==='talks'?profile.talks.find((_,index)=>extraDialog.recordId==='seminar-'+index):null;
    const showDialog=Boolean(id||extraDialog);

    useEffect(()=>{
        document.title=selectedProject ? `${selectedProject.title} · Harry Gomar` : 'Harry Gomar';
    },[selectedProject]);
    useEffect(()=>{
        const dialog=dialogRef.current;
        if(showDialog&&!dialog.open)dialog.showModal();
        if(!showDialog&&dialog.open)dialog.close();
        if(showDialog)dialog.scrollTop=0;
    },[showDialog,selectedProject,extraDialog]);
    useEffect(()=>{
        if((location.pathname==='/projects'&&!id)||location.hash==='#all-projects'){
            setArchiveOpen(true);
            archiveRef.current?.scrollIntoView({block:'start'});
        }
    },[location.pathname,location.hash,id]);
    useEffect(()=>{
        if(!showDialog)return undefined;
        const previous=document.body.style.overflow;
        document.body.style.overflow='hidden';
        return ()=>{document.body.style.overflow=previous;};
    },[showDialog]);

    const revealArchive=()=>{setArchiveOpen(true);};
    const openProject=projectId=>{
        setExtraDialog(null);
        navigate(`/projects/${projectId}`,{state:{returnTo:location.state?.returnTo||(id?'/':location.pathname+location.hash)}});
    };
    const closeDialog=()=>{
        setExtraDialog(null);
        if(id)navigate(location.state?.returnTo||'/',{replace:true});
    };
    const highlightProps=item=>({onPointerEnter:()=>setHighlight(item),onPointerLeave:()=>setHighlight(null),onFocus:()=>setHighlight(item),onBlur:()=>setHighlight(null)});
    const related=project=>selection?.kind==='record'?relatedRecords.find(record=>record.id===selection.id)?.projectId===project.id:selection?.kind==='project'?selection.id===project.id:selection?.kind==='topic'?projectInTopic(project,selection.id):selection?.kind==='affiliation'?project.affiliations.includes(selection.id):false;
    const recordRelated=recordId=>{const record=relatedRecords.find(item=>item.id===recordId);return selection?.kind==='record'?selection.id===recordId:record.projectId?related(homeProjects.find(project=>project.id===record.projectId)):selection?.kind==='topic'?selection.id===record.topicId:selection?.kind==='project'?projectInTopic(homeProjects.find(project=>project.id===selection.id),record.topicId):false;};
    const projectLink=project=> <Link to={`/projects/${project.id}`} state={{returnTo:location.pathname+location.hash}}
        className={`home-link ${related(project)?'is-active':''}`} {...highlightProps({kind:'project',id:project.id})}>{project.title}</Link>;
    const research=topics.filter(topic=>topic.research);

    return <div className="homepage-shell">
        <a className="home-skip" href="#home-content">Skip to content</a>
        <main className="homepage" id="home-content">
            <header className="home-header">
                <div><h1>{profile.name}</h1><p className="home-role">{profile.role}</p><div className="home-contact"><EmailLink/><CvLink/><a className="home-link" href="#writing">Writing</a></div></div>
                <div className="home-entry"><Link className="home-link" to="/experience"><svg className="home-experience-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="5.5"/><ellipse cx="12" cy="12" rx="11" ry="3.8" transform="rotate(-32 12 12)"/><circle cx="19.4" cy="4.7" r="1.5" className="home-experience-star"/></svg><span>Explore the interactive experience</span></Link><p>Space Train · 3D portfolio</p></div>
            </header>
            <Row label="Now" className="home-current"><div className="home-current-grid">{profile.experience.slice(0,2).map(item=><article key={item.organization}>
                <div className="home-current-heading"><h3>{item.organization.startsWith('MAKERS')?<button className="home-current-select" aria-pressed={pinned?.id==='makers'} onClick={()=>{pin({kind:'affiliation',id:'makers'});document.querySelector('.home-map')?.scrollIntoView({block:'center'});}}>{item.organization}</button>:item.organization}</h3><span>{item.dates.replace(' to present','–present')}</span></div>
                <p>{item.role}</p>
                <div className="home-context-links">{item.organization.startsWith('MAKERS')?<><a className="home-link" href="https://makers.itam.mx/" target="_blank" rel="noopener noreferrer">makers.itam.mx</a><a className="home-link" href="https://makers.itam.mx/proyectos" target="_blank" rel="noopener noreferrer">Computer Science projects</a></>:<a className="home-link" href="https://mantis.csail.mit.edu/" target="_blank" rel="noopener noreferrer">https://mantis.csail.mit.edu/</a>}</div>
            </article>)}</div></Row>
            <div className="home-workspace">
            <aside className="home-research-sidebar"><h2>Research</h2><div className="home-themes" role="region" aria-label="Research themes">{research.map(topic=><article key={topic.id} className={selection?.kind==='topic'&&selection.id===topic.id?'is-active':''} {...highlightProps({kind:'topic',id:topic.id})}>
                <h3><button className="home-theme-button" aria-pressed={pinned?.kind==='topic'&&pinned.id===topic.id} onClick={()=>pin({kind:'topic',id:topic.id})}>{topic.name}</button></h3><p className="home-muted">{topic.summary}</p>{topic.id==='data-science'&&<button className="home-link home-subtopic" onClick={()=>pin({kind:'topic',id:'geospatial'})}>Geospatial projects ↗</button>}
                <ul>{topic.highlights.map(projectId=><li key={projectId}>{projectLink(homeProjects.find(item=>item.id===projectId))}</li>)}
                    {topic.id==='nlp'&&<li><a className="home-link" {...highlightProps({kind:'record',id:'icits-2025'})} href={profile.publication.url} target="_blank" rel="noopener noreferrer">ICITS 2025 paper</a></li>}</ul>
            </article>)}</div>
                <section className="home-sidebar-teaching" aria-label="Teaching">
                    <h2><button className="home-theme-button" aria-pressed={pinned?.kind==='topic'&&pinned.id==='teaching'} onClick={()=>pin({kind:'topic',id:'teaching'})}>Teaching</button></h2>
                    <article {...highlightProps({kind:'project',id:31})}><h3><button className="home-talk-title" onClick={()=>openProject(31)}>MIT IAP · MIT Sloan</button></h3><p className="home-muted">{profile.teaching}</p></article>
                    <ul><li>{projectLink(homeProjects.find(project=>project.id===28))}</li></ul>
                </section>
            </aside>
            <HomeProjectMap projects={homeProjects} highlight={highlight} onHighlight={setHighlight} onOpen={openProject} pinned={pinned} onPin={setPinned} onOpenRecord={record=>setExtraDialog({type:record.kind==='publication'?'publication':'talks',recordId:record.id})}/>
            </div>
            <div className="home-reading">
                <Row label="Publications" {...highlightProps({kind:'record',id:'icits-2025'})} className={`home-publication ${recordRelated('icits-2025')?'is-related':''}`}>
                    <a className="home-link home-paper" href={profile.publication.url} target="_blank" rel="noopener noreferrer">{profile.publication.title}</a>
                    <p className="home-muted">{profile.publication.authors}</p><p className="home-muted">{profile.publication.shortVenue}</p>
                </Row>
                <Row label="Seminars and talks" className="home-seminars">
                    <ul className="home-seminar-list">{profile.talks.map((talk,index)=><li key={talk.title+talk.date} className={recordRelated('seminar-'+index)?'is-active':''} {...highlightProps({kind:'record',id:'seminar-'+index})}>
                        <time className="home-seminar-date">{talk.date}</time>
                        <article><h3><button className="home-talk-title" aria-describedby={'home-talk-subject-'+index} onClick={()=>setExtraDialog({type:'talks',recordId:'seminar-'+index})}>{talk.series}</button></h3><p className="home-seminar-subject" id={'home-talk-subject-'+index}>{talk.shortTitle||talk.title}</p><p className="home-muted">{talk.institution}</p></article>
                    </li>)}</ul>
                </Row>
                <Row label="Past experience" className="home-history"><ul>{profile.experience.slice(2).map(item=><li key={item.organization}>
                    <div className="home-history-heading"><h3>{item.organization}</h3><span className="home-muted">{item.dates}</span></div>
                    <p>{item.role}</p><p className="home-muted">{item.description}</p>
                </li>)}</ul></Row>
                <Row label="Writing" className="home-writing" id="writing"><p className="home-muted">Technical notes are in preparation.</p></Row>
                <Row label="Recognition" className="home-recognition"><ul>{profile.recognition.map(item=>{const parts=item.match(/^(.*), (\d{4}(?:–\d{4})?)$/);return <li key={item}><span className="home-award-year">{parts?.[2]}</span><span>{parts?.[1]||item}</span></li>;})}</ul></Row>
                <section className="home-archive" id="all-projects" ref={archiveRef} aria-label="All projects">
                    <button className="home-archive-toggle home-link" aria-expanded={archiveOpen} aria-controls="project-archive" onClick={()=>setArchiveOpen(open=>!open)}>{archiveOpen?'Hide projects':'View all projects'}</button>
                    <div id="project-archive" className="home-archive-groups" hidden={!archiveOpen}>{topics.map(topic=><section key={topic.id}><h3>{topic.name}</h3><ul>{homeProjects.filter(project=>project.topics[0]===topic.id).map(project=><li key={project.id}>{projectLink(project)}</li>)}</ul></section>)}</div>
                </section>
            </div>
            <Row label="Visual studies" className="home-images" aria-label="Visual studies"><div className="home-images-grid">{images.map((image,index)=><figure key={image.src}><button aria-label={`Enlarge ${image.title}`} onClick={()=>setExtraDialog({type:'image',index})}><img src={image.src} alt={image.alt} width={index===0?1959:1320} height={index===0?1125:1160} loading="lazy"/></button><figcaption>{index===1?<button className="home-link" onClick={()=>openProject(7)}>{image.title}</button>:image.title}</figcaption></figure>)}</div></Row>
            <footer className="home-footer"><span>{profile.fullName}</span><div><CvLink/><EmailLink/></div></footer>
        </main>
        <dialog ref={dialogRef} className="home-dialog" aria-labelledby="home-dialog-title" onCancel={event=>{event.preventDefault();closeDialog();}} onClick={event=>{
            if(event.target!==event.currentTarget)return;
            const bounds=event.currentTarget.getBoundingClientRect();
            if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeDialog();
        }}>
            <button className="home-dialog-close" onClick={closeDialog} aria-label="Close details">Close</button>
            {id ? selectedProject ? <article>
                <p className="home-detail-meta">{topicNames(selectedProject)} · {selectedProject.years}</p><h2 id="home-dialog-title">{selectedProject.title}</h2>
                {selectedProject.contribution&&<p className="home-detail-contribution">{selectedProject.contribution}</p>}
                <Description text={selectedProject.description}/>
                {selectedProject.skills?.length>0&&<p className="home-detail-skills">{selectedProject.skills.join(' · ')}</p>}
                {selectedProject.publications?.length>0&&<><h3>Publications</h3><ul>{selectedProject.publications.map(text=><li key={text}>{text}</li>)}</ul></>}
                {selectedProject.presentations?.length>0&&<><h3>Presentations</h3><ul>{selectedProject.presentations.map(text=><li key={text}>{text}</li>)}</ul></>}
                {profile.talks.some(talk=>talk.projectId===selectedProject.id)&&<><h3>Seminars and talks</h3><ul className="home-project-talks">{profile.talks.map((talk,index)=>talk.projectId===selectedProject.id&&<li key={index}><button className="home-link" onClick={()=>{navigate(location.state?.returnTo||'/',{replace:true});setExtraDialog({type:'talks',recordId:'seminar-'+index});}}>{talk.series}</button><p>{talk.shortTitle||talk.title} · {talk.institution}</p></li>)}</ul></>}
                {selectedProject.relatedProjectIds?.length>0&&<section className="home-related-work" aria-label="Related work"><h3>Related work</h3><ul>{selectedProject.relatedProjectIds.map(projectId=>{const project=homeProjects.find(item=>item.id===projectId);return <li key={projectId}><button className="home-link" onClick={()=>openProject(projectId)}>{project.title}</button></li>;})}</ul></section>}
                <div className="home-detail-links">{selectedProject.id===7&&<a className="home-link" href={profile.publication.url} target="_blank" rel="noopener noreferrer">Read the publication</a>}{selectedProject.githubUrl&&<a className="home-link" href={selectedProject.githubUrl} target="_blank" rel="noopener noreferrer">GitHub</a>}{selectedProject.liveUrl&&<a className="home-link" href={selectedProject.liveUrl} target="_blank" rel="noopener noreferrer">Visit project</a>}{selectedProject.links?.map(link=><a key={link.url} className="home-link" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}{selectedProject.id===18&&<Link className="home-link" to="/experience">Explore the interactive experience</Link>}</div>
            </article>:<article><h2 id="home-dialog-title">Project not found</h2><p>This project is not in the archive.</p><button className="home-link" onClick={closeDialog}>Return to the index</button></article>
            :selectedTalk?<article className="home-talk-detail">
                <p className="home-detail-meta">{selectedTalk.series}<br/>{selectedTalk.institution}</p>
                <h2 id="home-dialog-title">{selectedTalk.title}</h2>
                <p className="home-detail-meta">{[selectedTalk.date,selectedTalk.time,selectedTalk.location].filter(Boolean).join(' · ')}</p>
                <section lang="es"><h3>{selectedTalk.abstract?'Resumen':'Sobre la charla'}</h3><Description text={selectedTalk.abstract||selectedTalk.summary}/></section>
                <div className="home-detail-links">{selectedTalk.projectId&&<button className="home-link" onClick={()=>openProject(selectedTalk.projectId)}>{homeProjects.find(project=>project.id===selectedTalk.projectId)?.title}</button>}{selectedTalk.poster&&<a className="home-link" href={selectedTalk.poster} target="_blank" rel="noopener noreferrer">Ver cartel</a>}{selectedTalk.seriesUrl&&<a className="home-link" href={selectedTalk.seriesUrl} target="_blank" rel="noopener noreferrer">About the seminar</a>}</div>
            </article>
            :extraDialog?.type==='publication'?<article><h2 id="home-dialog-title">{profile.publication.title}</h2><p>{profile.publication.authors}</p><p>{profile.publication.venue}</p><a className="home-link" href={profile.publication.url} target="_blank" rel="noopener noreferrer">Read publication</a></article>:extraDialog?.type==='image'?<figure><h2 id="home-dialog-title">{images[extraDialog.index].title}</h2><img className="home-enlarged-image" src={images[extraDialog.index].src} alt={images[extraDialog.index].alt}/></figure>:null}
        </dialog>
    </div>;
}
