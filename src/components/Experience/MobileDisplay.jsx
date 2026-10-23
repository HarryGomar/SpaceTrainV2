import React,{useLayoutEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import Projects from '../Projects/Projects';
import ProjectDetail from '../Projects/ProjectDetail';

export default function MobileDisplay({screen,onClose}) {
    const [projectId,setProjectId]=useState(null);
    const contentRef=useRef(null);
    const listScroll=useRef(0);
    useLayoutEffect(()=>{contentRef.current.scrollTop=projectId===null?listScroll.current:0;},[projectId]);
    const openProject=id=>{listScroll.current=contentRef.current.scrollTop;setProjectId(id);};
    return <section className="experience-mobile-display" aria-label={screen==='projects'?'Train projects':'Train terminal'}>
        <header>{projectId!==null?<><button onClick={()=>setProjectId(null)}>← Projects</button><button aria-label="Return to train" onClick={onClose}>Train</button></>:<button onClick={onClose}>← Return to train</button>}<Link to="/">Main screen</Link></header>
        <div className="experience-mobile-display__content" ref={contentRef}>
            {screen==='projects'?<><div hidden={projectId!==null}><Projects embedded mobileDisplay onOpenProject={openProject}/></div>{projectId!==null&&<ProjectDetail embedded mobileDisplay projectId={projectId} onReturn={()=>setProjectId(null)}/>}</>
                :<iframe title="Train terminal" src="https://terminal-inner-website.vercel.app/" referrerPolicy="strict-origin-when-cross-origin" allow="clipboard-read; clipboard-write"/>}
        </div>
    </section>;
}
