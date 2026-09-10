import React, {useMemo, useState} from 'react';
import {fields, layoutProjectMap, projectNumber} from './homeProjects';

export default function HomeProjectMap({projects,activeId,onHighlight,onOpen}) {
    const [field,setField] = useState('All');
    const [pinnedId,setPinnedId] = useState(null);
    const {regions,nodes,edges} = useMemo(() => layoutProjectMap(projects,field),[projects,field]);
    const selectedId = activeId ?? pinnedId;
    const active = nodes.find(project => project.id === selectedId);
    const connections = active ? edges.filter(edge => edge.source===active.id||edge.target===active.id) : [];
    const neighbors = new Set(connections.flatMap(edge=>[edge.source,edge.target]));
    const reset = () => {setPinnedId(null);onHighlight(null);};
    const select = id => {const next=pinnedId===id?null:id;setPinnedId(next);onHighlight(next);};

    return <section className="home-map" aria-label="Interactive project map" onKeyDown={event=>{
        if(event.key==='Escape'){reset();event.stopPropagation();}
    }}>
        <div className="home-map-filters" role="group" aria-label="Project map field">
            {['All',...fields].map(name => <button key={name} aria-pressed={field===name} onClick={() => {setField(name);reset();}}>{name}</button>)}
        </div>
        <div className="home-graph home-graph-network">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <g fill="none">{edges.map(edge => {
                    const connected=edge.source===selectedId||edge.target===selectedId;
                    const matches=edge.from.matches||edge.to.matches;
                    return <path key={edge.source+'-'+edge.target} data-source={edge.source} data-target={edge.target}
                        className={connected?'is-active':active||!matches?'is-muted':edge.strong?'is-strong':'is-secondary'}
                        d={'M'+edge.from.x+' '+edge.from.y+' L'+edge.to.x+' '+edge.to.y}/>;
                })}</g>
            </svg>
            {regions.map(region => <span className={'home-graph-region '+(field!=='All'&&field!==region.category?'is-muted':'')} key={region.category} style={{left:region.x+'%',top:region.y+'%'}}>{region.category}</span>)}
            {nodes.map(node => {
                const selected=node.id===selectedId;
                const related=neighbors.has(node.id);
                const muted=active?!related:!node.matches;
                return <button key={node.id} data-project-id={node.id}
                    className={['home-graph-node',selected?'is-active':related?'is-related':muted?'is-muted':'',
                        node.y>78?'is-at-bottom':'',node.x<27?'is-at-left':node.x>73?'is-at-right':''].join(' ')}
                    style={{left:node.x+'%',top:node.y+'%'}} aria-label={node.title+', '+node.category}
                    aria-pressed={pinnedId===node.id} onClick={() => select(node.id)}
                    onPointerEnter={event => {if(event.pointerType!=='touch')onHighlight(node.id);}}
                    onPointerLeave={() => onHighlight(pinnedId)} onFocus={() => onHighlight(node.id)} onBlur={() => onHighlight(pinnedId)}>
                    <i aria-hidden="true"/><span className="home-node-number" aria-hidden="true">{projectNumber(node.id)}</span>
                    {(node.shortName||selected)&&<span className={'home-node-name '+(selected?'is-revealed':'')} aria-hidden="true">{selected?node.title:node.shortName}</span>}
                </button>;
            })}
        </div>
        <div className="home-map-caption">
            {active ? <>
                <div className="home-map-selection"><button className="home-link" onClick={() => onOpen(active.id)}>{active.title}</button>
                    {pinnedId!==null&&<button className="home-map-clear" onClick={reset}>Clear selection</button>}</div>
                <p>{active.summary}</p>
                {connections.length>0&&<ul className="home-map-connections" aria-label="Related projects">
                    {connections.map(edge => {
                        const other=edge.source===active.id?edge.to:edge.from;
                        return <li key={other.id}><button className="home-link" onClick={()=>onOpen(other.id)}>{other.title}</button><span>{edge.reason}</span></li>;
                    })}
                </ul>}
            </> : <><span>{field==='All'?nodes.length+' projects across '+regions.length+' fields':nodes.filter(node=>node.matches).length+' '+field+' projects highlighted'}</span><a className="home-link" href="#all-projects">Browse the complete index</a></>}
        </div>
    </section>;
}
