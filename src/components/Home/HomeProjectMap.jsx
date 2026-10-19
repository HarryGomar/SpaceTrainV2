import React, {useMemo, useState} from 'react';
import {layoutProjectMap, projectsInTopic, topicById} from './homeProjects';

// Selection is either {kind:'project',id} or {kind:'topic',id}; hover state comes from the page.
export default function HomeProjectMap({projects,highlight,onHighlight,onOpen,onBrowse}) {
    const [pinned,setPinned] = useState(null);
    const {nodes,hubs,edges} = useMemo(() => layoutProjectMap(projects),[projects]);
    const selection = highlight ?? pinned;
    const project = selection?.kind==='project' ? nodes.find(node => node.id===selection.id) : null;
    const topic = selection?.kind==='topic' ? hubs.find(hub => hub.id===selection.id) : null;
    const isPinned = (kind,id) => pinned?.kind===kind&&pinned.id===id;
    const reset = () => {setPinned(null);onHighlight(null);};
    const pin = next => {const value=isPinned(next.kind,next.id)?null:next;setPinned(value);onHighlight(value);};
    const hoverProps = item => ({
        onPointerEnter:event => {if(event.pointerType!=='touch')onHighlight(item);},
        onPointerLeave:() => onHighlight(pinned),
        onFocus:() => onHighlight(item),
        onBlur:() => onHighlight(pinned),
    });
    const edgeActive = edge => project ? edge.project===project.id : topic ? edge.topic===topic.id : false;
    const nodeState = node => project ? (node.id===project.id?'is-active':'is-muted')
        : topic ? (node.topics.includes(topic.id)?'is-related':'is-muted') : '';
    const hubState = hub => topic ? (hub.id===topic.id?'is-active':'is-muted')
        : project ? (project.topics.includes(hub.id)?'is-related':'is-muted') : '';

    return <section className="home-row home-map" aria-label="Interactive project map" onKeyDown={event=>{
        if(event.key==='Escape'){reset();event.stopPropagation();}
    }}>
        <div className="home-row-label"><h2>Projects</h2><p className="home-map-count">{nodes.length} across {hubs.length} topics</p>
            <div className="home-map-caption" aria-live="polite">
                {project ? <>
                    <button className="home-link home-map-title" onClick={() => onOpen(project.id)}>{project.title}</button>
                    <p>{project.summary}</p>
                    <div className="home-map-actions">
                        {project.topics.map(id => <button key={id} className="home-map-chip" onClick={() => pin({kind:'topic',id})}>{topicById.get(id).name}</button>)}
                        {pinned&&<button className="home-map-clear" onClick={reset}>Clear selection</button>}
                    </div>
                </> : topic ? <>
                    <div className="home-map-title">{topic.name} <span>{topic.count} projects</span></div>
                    <p>{topic.summary}</p>
                    <ul className="home-map-list" aria-label={topic.name+' projects'}>{projectsInTopic(nodes,topic.id).map(item =>
                        <li key={item.id}><button className="home-link" onClick={() => onOpen(item.id)}>{item.title}</button></li>)}</ul>
                    {pinned&&<button className="home-map-clear" onClick={reset}>Clear selection</button>}
                </> : <>
                    <span>Lines join each project to its topics. Select a topic or a project to explore.</span>
                    <a className="home-link" href="#all-projects" onClick={onBrowse}>Browse the complete index</a>
                </>}
            </div>
            </div>
        <div className="home-row-body home-graph">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <g fill="none">{edges.map(edge => <path key={edge.project+'-'+edge.topic} data-project={edge.project} data-topic={edge.topic}
                    className={edgeActive(edge)?'is-active':selection?'is-muted':edge.to.research?'is-research':''}
                    d={'M'+edge.from.x+' '+edge.from.y+' L'+edge.to.x+' '+edge.to.y}/>)}</g>
            </svg>
            {hubs.map(hub => <button key={hub.id} data-topic-id={hub.id}
                className={['home-map-hub',hub.research?'is-research':'',hubState(hub)].join(' ')}
                style={{left:hub.x+'%',top:hub.y+'%'}} aria-label={hub.name+', '+hub.count+' projects'}
                aria-pressed={isPinned('topic',hub.id)} onClick={() => pin({kind:'topic',id:hub.id})} {...hoverProps({kind:'topic',id:hub.id})}>
                {hub.label}<span aria-hidden="true">{hub.count}</span>
            </button>)}
            {nodes.map(node => <button key={node.id} data-project-id={node.id}
                className={['home-graph-node',nodeState(node),node.x<14?'is-at-left':node.x>86?'is-at-right':''].join(' ')}
                style={{left:node.x+'%',top:node.y+'%'}} aria-label={node.title+', '+node.topics.map(id=>topicById.get(id).name).join(', ')}
                aria-pressed={isPinned('project',node.id)} onClick={() => pin({kind:'project',id:node.id})} {...hoverProps({kind:'project',id:node.id})}>
                <i aria-hidden="true"/><span className="home-node-name" aria-hidden="true">{node.shortName}</span>
            </button>)}
        </div>
    </section>;
}
