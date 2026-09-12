import React, {useEffect, useRef, useState} from 'react';
import {Link, useLocation, useNavigate, useParams} from 'react-router-dom';
import {profile} from '../../data/profile';
import {fields, homeProjects, projectConnections, projectNumber, selectedIds} from './homeProjects';
import HomeProjectMap from './HomeProjectMap';
import './Home.css';

const images = [
    {src:'/home/clusters-overview.png',title:'Point-cloud study',alt:'Four colored point clusters with different shapes and densities'},
    {src:'/ProjectImages/UOL.png',title:'Universo de Leyes',alt:'Violet point-cloud visualization from the Universo de Leyes project'},
];
const CvLink = () => <a className="home-link home-cv" href="/home/harry-gomar-cv.pdf" download="Rafael Harry Gomar Dawson - CV.pdf">CV <span>PDF</span></a>;
const EmailLink = () => <a className="home-link home-email" href={`mailto:${profile.email}`}>{profile.email}</a>;

function Description({text}) {
    return text.split(/\n\s*\n/).map((block,i) => {
        const lines=block.split('\n');
        const listStart=lines.findIndex(line=>line.trim().startsWith('- '));
        return listStart<0 ? <p key={i}>{block}</p> : <div key={i}>{listStart>0&&<p>{lines.slice(0,listStart).join(' ')}</p>}<ul>{lines.slice(listStart).map((line,j)=><li key={j}>{line.replace(/^\s*-\s*/,'')}</li>)}</ul></div>;
    });
}

export default function Home() {
    const [activeId,setActiveId]=useState(null);
    const [extraDialog,setExtraDialog]=useState(null);
    const [archiveOpen,setArchiveOpen]=useState(false);
    const dialogRef=useRef(null);
    const archiveRef=useRef(null);
    const navigate=useNavigate();
    const location=useLocation();
    const {id}=useParams();
    const selectedProject=id ? homeProjects.find(project=>project.id===Number(id)) : null;
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
    const relatedProject=homeProjects.find(project=>project.id===extraDialog?.projectId);
    const relatedConnections=relatedProject?projectConnections.filter(edge=>edge.source===relatedProject.id||edge.target===relatedProject.id):[];
    const openProject=projectId=>{
        setExtraDialog(null);
        navigate(`/projects/${projectId}`,{state:{returnTo:location.state?.returnTo||(id?'/':location.pathname+location.hash)}});
    };
    const closeDialog=()=>{
        setExtraDialog(null);
        if(id)navigate(location.state?.returnTo||'/',{replace:true});
    };
    const projectLink=(project,withNumber=false)=> <Link to={`/projects/${project.id}`} state={{returnTo:location.pathname+location.hash}} className={`home-link ${activeId===project.id?'is-active':''}`}
        onPointerEnter={()=>setActiveId(project.id)} onPointerLeave={()=>setActiveId(null)} onFocus={()=>setActiveId(project.id)} onBlur={()=>setActiveId(null)}>
        {withNumber&&<span className="home-index-number">{projectNumber(project.id)}</span>}{project.title}
    </Link>;

    return <div className="homepage-shell">
        <a className="home-skip" href="#home-content">Skip to content</a>
        <main className="homepage" id="home-content">
            <header className="home-header">
                <div><h1>{profile.name}</h1><p className="home-role">{profile.role}</p><div className="home-contact"><EmailLink/><CvLink/></div></div>
                <div className="home-entry"><Link className="home-link" to="/experience">Explore the interactive experience</Link><p>Space Train · 3D portfolio</p></div>
            </header>
            <div className="home-intro"><p>{profile.introduction}</p><p>{profile.affiliations}</p></div>
            <div className="home-primary-grid">
                <div className="home-project-column"><section className="home-selected" aria-labelledby="selected-heading"><h2 id="selected-heading">Selected projects</h2><ul>{selectedIds.map(projectId=>{
                    const project=homeProjects.find(item=>item.id===projectId);
                    return <li key={project.id}>{projectLink(project)}<p>{project.summary}</p></li>;
                })}</ul><a className="home-link home-more" href="#all-projects" onClick={revealArchive}>All {homeProjects.length} projects</a></section>
                    <section className="home-current"><h2>Current work</h2><div>{profile.experience.slice(0,2).map(item=><article key={item.organization}><h3>{item.organization}</h3><p>{item.role}</p><span>{item.dates}</span></article>)}</div></section>
                </div>
                <aside><HomeProjectMap projects={homeProjects} activeId={activeId} onHighlight={setActiveId} onOpen={openProject} onBrowse={revealArchive} onConnections={projectId=>setExtraDialog({type:'connections',projectId})}/></aside>
            </div>
            <div className="home-information">
                <section><h2>Publication</h2><a className="home-link home-paper" href={profile.publication.url} target="_blank" rel="noopener noreferrer">{profile.publication.title}</a><p className="home-authors">{profile.publication.authors}</p><p className="home-venue">{profile.publication.venue}</p></section>
                <section><h2>Teaching</h2><p className="home-teaching">{profile.teaching}</p><button className="home-link home-more" onClick={()=>setExtraDialog({type:'talks'})}>Seminars and talks</button></section>
            </div>
            <section className="home-recognition"><h2>Recognition</h2><ul>{profile.recognition.map(item=><li key={item}>{item}</li>)}</ul></section>
            <section className="home-archive" id="all-projects" ref={archiveRef} aria-label="All projects">
                <div className="home-archive-heading"><h2 id="archive-heading"><button className="home-archive-toggle" aria-expanded={archiveOpen} aria-controls="project-archive" onClick={()=>setArchiveOpen(open=>!open)}>All projects <span>{archiveOpen?'Hide':'Show'} {homeProjects.length}</span></button></h2></div>
                <div id="project-archive" className="home-archive-groups" hidden={!archiveOpen}>{fields.map(field=><section key={field}><h3>{field}</h3><ul>{homeProjects.filter(project=>project.category===field).map(project=><li key={project.id}>{projectLink(project,true)}</li>)}</ul></section>)}</div>
            </section>
            <section className="home-images" aria-label="Visual studies">{images.map((image,index)=><figure key={image.src}><button aria-label={`Enlarge ${image.title}`} onClick={()=>setExtraDialog({type:'image',index})}><img src={image.src} alt={image.alt} width={index===0?1959:1320} height={index===0?1125:1160} loading="lazy"/></button><figcaption>{index===1?<button className="home-link" onClick={()=>openProject(7)}>{image.title}</button>:image.title}</figcaption></figure>)}</section>
            <footer className="home-footer"><span>{profile.fullName}</span><div><CvLink/><EmailLink/></div></footer>
        </main>
        <dialog ref={dialogRef} className="home-dialog" aria-labelledby="home-dialog-title" onCancel={event=>{event.preventDefault();closeDialog();}} onClick={event=>{
            if(event.target!==event.currentTarget)return;
            const bounds=event.currentTarget.getBoundingClientRect();
            if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)closeDialog();
        }}>
            <button className="home-dialog-close" onClick={closeDialog} aria-label="Close details">Close</button>
            {id ? selectedProject ? <article>
                <p className="home-detail-meta">{selectedProject.category} · {selectedProject.years}</p><h2 id="home-dialog-title">{selectedProject.title}</h2><Description text={selectedProject.description}/>
                {selectedProject.skills?.length>0&&<p className="home-detail-skills">{selectedProject.skills.join(' · ')}</p>}
                {selectedProject.publications?.length>0&&<><h3>Publications</h3><ul>{selectedProject.publications.map(text=><li key={text}>{text}</li>)}</ul></>}
                {selectedProject.presentations?.length>0&&<><h3>Presentations</h3><ul>{selectedProject.presentations.map(text=><li key={text}>{text}</li>)}</ul></>}
                <div className="home-detail-links">{selectedProject.id===7&&<a className="home-link" href={profile.publication.url} target="_blank" rel="noopener noreferrer">Read the publication</a>}{selectedProject.githubUrl&&<a className="home-link" href={selectedProject.githubUrl} target="_blank" rel="noopener noreferrer">GitHub</a>}{selectedProject.liveUrl&&<a className="home-link" href={selectedProject.liveUrl} target="_blank" rel="noopener noreferrer">Visit project</a>}{selectedProject.id===18&&<Link className="home-link" to="/experience">Explore the interactive experience</Link>}</div>
            </article>:<article><h2 id="home-dialog-title">Project not found</h2><p>This project is not in the archive.</p><button className="home-link" onClick={closeDialog}>Return to the index</button></article>
            :extraDialog?.type==='connections'&&relatedProject?<section><h2 id="home-dialog-title">{relatedProject.title}</h2><p className="home-detail-meta">Related projects</p><ul className="home-related-projects" aria-label="Related projects">{relatedConnections.map(edge=>{
                const other=homeProjects.find(project=>project.id===(edge.source===relatedProject.id?edge.target:edge.source));
                return <li key={other.id}><button className="home-link" onClick={()=>openProject(other.id)}>{other.title}</button><p>{edge.reason}</p></li>;
            })}</ul></section>
            :extraDialog?.type==='talks'?<section><h2 id="home-dialog-title">Seminars and talks</h2>{profile.talks.map(talk=><article className="home-talk" key={talk.title+talk.date}><h3>{talk.title}</h3><p>{talk.venue}</p><span>{talk.date}</span></article>)}</section>
            :extraDialog?.type==='image'?<figure><h2 id="home-dialog-title">{images[extraDialog.index].title}</h2><img className="home-enlarged-image" src={images[extraDialog.index].src} alt={images[extraDialog.index].alt}/></figure>:null}
        </dialog>
    </div>;
}
