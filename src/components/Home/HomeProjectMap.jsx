import React, {useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {layoutProjectMap, projectInTopic, relatedRecords, topicById} from './homeProjects';

// Persistent selection is shared with the page; hover previews it temporarily.
export default function HomeProjectMap({projects,highlight,onHighlight,onOpen,pinned,onPin,onOpenRecord}) {
    const {nodes,hubs,edges} = useMemo(() => layoutProjectMap(projects),[projects]);
    const graphRef=useRef(null);
    const [mobileView,setMobileView]=useState('list');
    const maskId='graph-labels-'+useId().replaceAll(':','');
    const [labelMasks,setLabelMasks]=useState([]);
    useLayoutEffect(()=>{
        const graph=graphRef.current;
        const measure=()=>{
            if(!graph.isConnected)return;
            const bounds=graph.getBoundingClientRect();
            if(!bounds.width||!bounds.height)return;
            const masks=[...graph.querySelectorAll('.home-map-hub,.home-node-name')].map(label=>{
                const box=label.getBoundingClientRect();
                return {x:(box.left-bounds.left-4)/bounds.width*100,y:(box.top-bounds.top-3)/bounds.height*100,width:(box.width+8)/bounds.width*100,height:(box.height+6)/bounds.height*100};
            });
            setLabelMasks(previous=>JSON.stringify(previous)===JSON.stringify(masks)?previous:masks);
        };
        measure();
        document.fonts?.ready.then(measure);
        const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);
        observer?.observe(graph);
        window.addEventListener('resize',measure);
        return ()=>{observer?.disconnect();window.removeEventListener('resize',measure);};
    },[nodes,hubs,mobileView]);
    const selection = highlight ?? pinned;
    const record=selection?.kind==='record'?relatedRecords.find(item=>item.id===selection.id):null;
    const project = record ? nodes.find(node=>node.id===record.projectId) : selection?.kind==='project' ? nodes.find(node => node.id===selection.id) : null;
    const topic = selection?.kind==='topic' ? hubs.find(hub => hub.id===selection.id) : record?.topicId ? hubs.find(hub=>hub.id===record.topicId) : null;
    const affiliation = selection?.kind==='affiliation' ? selection.id : null;
    const affiliated = nodes.filter(node=>node.affiliations.includes(affiliation));
    const isPinned = (kind,id) => pinned?.kind===kind&&pinned.id===id;
    const reset = () => {onPin(null);onHighlight(null);};
    const pin = next => {const value=isPinned(next.kind,next.id)?null:next;onPin(value);onHighlight(value);};
    const hoverProps = item => ({
        onPointerEnter:event => {if(event.pointerType!=='touch')onHighlight(item);},
        onPointerLeave:() => onHighlight(pinned),
        onFocus:() => onHighlight(item),
        onBlur:() => onHighlight(pinned),
    });
    const edgeActive = edge => project ? edge.project===project.id : topic ? projectInTopic(edge.from,topic.id)&& (edge.topic===topic.id||topicById.get(edge.topic)?.parent===topic.id) : affiliation ? affiliated.some(node=>node.id===edge.project) : false;
    const nodeState = node => project ? (node.id===project.id?(record?'is-related':'is-active'):'is-muted')
        : topic ? (projectInTopic(node,topic.id)?'is-related':'is-muted') : affiliation ? (node.affiliations.includes(affiliation)?'is-related':'is-muted') : '';
    const hubState = hub => topic ? (hub.id===topic.id?'is-active':hub.parent===topic.id||topic.parent===hub.id?'is-related':'is-muted')
        : project ? (projectInTopic(project,hub.id)?'is-related':'is-muted') : affiliation ? (affiliated.some(node=>projectInTopic(node,hub.id))?'is-related':'is-muted') : '';

    const recordRelated = item => record ? record.id===item.id : project ? project.id===item.projectId || item.topicId&&projectInTopic(project,item.topicId) : topic ? item.topicId===topic.id || Boolean(item.projectId&&projectInTopic(nodes.find(node=>node.id===item.projectId),topic.id)) : affiliation ? affiliated.some(node=>node.id===item.projectId) : false;
    return <section className="home-map" data-mobile-view={mobileView} aria-label="Interactive project map" onKeyDown={event=>{
        if(event.key==='Escape'){reset();event.stopPropagation();}
    }}>
        <div className="home-map-heading"><h2>Work and connections</h2>
            <div className="home-map-view" role="group" aria-label="Work view"><button aria-pressed={mobileView==='list'} onClick={()=>setMobileView('list')}>List</button><button aria-pressed={mobileView==='map'} onClick={()=>setMobileView('map')}>Map</button></div>
        </div>
        <div className="home-mobile-work-list">{hubs.map(hub=>{
            const expanded=pinned?.kind==='topic'&&pinned.id===hub.id;
            const records=relatedRecords.filter(item=>item.topicId===hub.id||item.projectId&&projectInTopic(nodes.find(node=>node.id===item.projectId),hub.id));
            return <section key={hub.id}><h3><button className="home-mobile-topic" aria-expanded={expanded} aria-controls={'mobile-topic-'+hub.id} onClick={()=>pin({kind:'topic',id:hub.id})}>{hub.name}<span aria-hidden="true">{expanded?'−':'+'}</span></button></h3>
                <div id={'mobile-topic-'+hub.id} hidden={!expanded}><p className="home-mobile-topic-summary">{hub.summary}</p><ul>{nodes.filter(node=>projectInTopic(node,hub.id)).map(node=><li key={node.id}><button className="home-mobile-work" onClick={()=>onOpen(node.id)}><span>{node.title}</span><small>{node.years}</small></button></li>)}{records.map(item=><li key={item.id}><button className="home-mobile-work" onClick={()=>onOpenRecord(item)}><span>{item.shortTitle||item.title}</span><small>{item.kind==='publication'?'Publication':item.series}</small></button></li>)}</ul></div>
            </section>;
        })}</div>
        <div className="home-map-viewport" tabIndex={mobileView==='map'?0:-1} aria-label="Project relationship map">
        <div className="home-graph-legend" aria-label="Graph legend"><span><i className="project"/>Project</span><span><i/>Publication</span><span><i className="seminar"/>Seminar</span></div>
        <div className="home-graph" ref={graphRef}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect x="0" y="0" width="100" height="100" fill="white"/>{labelMasks.map((box,index)=><rect key={index} {...box} fill="black"/>)}</mask></defs>
                <g fill="none" mask={`url(#${maskId})`}>{hubs.filter(hub=>hub.parent).map(hub=><path key={hub.id} className="home-topic-parent" d={`M${hub.x} ${hub.y} L${topicById.get(hub.parent).x} ${topicById.get(hub.parent).y}`}/>)}{relatedRecords.map(item=>{const target=item.projectId?nodes.find(node=>node.id===item.projectId):hubs.find(hub=>hub.id===item.topicId);return <path key={item.id} data-record-edge={item.id} className={'is-record-edge'+(recordRelated(item)?' is-active':'')} d={`M${item.x} ${item.y} L${target.x} ${target.y}`}/>;})}{edges.map(edge => <path key={edge.project+'-'+edge.topic} data-project={edge.project} data-topic={edge.topic}
                    className={'is-connection'+(edgeActive(edge)?' is-active':'')}
                    d={edge.path}/>)}</g>
            </svg>
            {hubs.map(hub => <button key={hub.id} data-topic-id={hub.id}
                className={['home-map-hub',hub.research?'is-research':hub.parent?'is-subtopic':'',hubState(hub)].join(' ')}
                style={{left:hub.x+'%',top:hub.y+'%'}} aria-label={hub.name+', '+hub.count+' projects'}
                aria-pressed={isPinned('topic',hub.id)} onClick={() => pin({kind:'topic',id:hub.id})} {...hoverProps({kind:'topic',id:hub.id})}>
                {hub.label}<span aria-hidden="true">{hub.count}</span>
            </button>)}
            {relatedRecords.map(item=><button key={item.id} data-record-id={item.id} className={['home-record-node',item.kind,item.x<14?'is-at-left':'',recordRelated(item)?record?.id===item.id?'is-active':'is-related':selection?'is-muted':''].join(' ')} style={{left:item.x+'%',top:item.y+'%'}} aria-label={[item.kind+': '+item.title,item.series,item.institution].filter(Boolean).join(', ')} aria-pressed={isPinned('record',item.id)} onClick={()=>onOpenRecord(item)} {...hoverProps({kind:'record',id:item.id})}><i aria-hidden="true"/><span className="home-node-name" aria-hidden="true">{item.shortName}</span></button>)}
            {nodes.map(node => <button key={node.id} data-project-id={node.id}
                className={['home-graph-node',nodeState(node),node.x<14?'is-at-left':node.x>86?'is-at-right':''].join(' ')}
                style={{left:node.x+'%',top:node.y+'%'}} aria-label={node.title+', '+node.topics.map(id=>topicById.get(id).name).join(', ')}
                aria-pressed={isPinned('project',node.id)} onClick={() => onOpen(node.id)} {...hoverProps({kind:'project',id:node.id})}>
                <i aria-hidden="true"/><span className="home-node-name" aria-hidden="true">{node.shortName}</span>
            </button>)}
        </div>
        </div>
    </section>;
}
