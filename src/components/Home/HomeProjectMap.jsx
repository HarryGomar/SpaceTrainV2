import React, {useMemo, useState} from 'react';
import {fields, layoutProjectMap, projectNumber} from './homeProjects';

export default function HomeProjectMap({projects,activeId,onHighlight,onOpen}) {
    const [field,setField] = useState('All');
    const {hubs,nodes} = useMemo(() => layoutProjectMap(projects,field),[projects,field]);
    const active = projects.find(project => project.id === activeId);
    return <section className="home-map" aria-label="Interactive project map">
        <div className="home-map-filters" role="group" aria-label="Project map field">
            {['All',...fields].map(name => <button key={name} aria-pressed={field===name} onClick={() => {setField(name);onHighlight(null);}}>{name}</button>)}
        </div>
        <div className={`home-graph ${field!=='All'?'home-graph-field':''}`}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <g fill="none">{nodes.map(node => <path key={node.id} className={node.id===activeId?'is-active':''} d={`M${node.hubX} ${node.hubY} L${node.x} ${node.y}`}/>)}</g>
                {hubs.map(hub => <circle key={hub.category} cx={hub.x} cy={hub.y} r=".5"/>)}
            </svg>
            {hubs.map(hub => <span className="home-graph-hub" key={hub.category} style={{left:`${hub.x}%`,top:`${hub.y}%`}}>{hub.category}</span>)}
            {nodes.map(node => <button key={node.id} className={`home-graph-node ${activeId===node.id?'is-active':''}`} style={{left:`${node.x}%`,top:`${node.y}%`}}
                aria-label={`${node.title}, ${node.category}`} onClick={() => onOpen(node.id)} onPointerEnter={() => onHighlight(node.id)} onPointerLeave={() => onHighlight(null)} onFocus={() => onHighlight(node.id)} onBlur={() => onHighlight(null)}>
                <i aria-hidden="true"/><span className="home-node-number" aria-hidden="true">{projectNumber(node.id)}</span>
                {field!=='All'&&<span className="home-node-name" aria-hidden="true">{node.title}</span>}
            </button>)}
        </div>
        <div className="home-map-caption">
            {active ? <><button className="home-link" onClick={() => onOpen(active.id)}>{active.title}</button><p>{active.summary}</p></> : <><span>{nodes.length} projects{field==='All'?` across ${hubs.length} fields`:` in ${field}`}</span><a className="home-link" href="#all-projects">Browse the complete index</a></>}
        </div>
    </section>;
}
