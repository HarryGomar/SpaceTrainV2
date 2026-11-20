import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { profile } from '../../data/profile';
import { homeProjects } from '../Home/homeProjects';
import TldrToggle from './TldrToggle';
import './Tldr.css';

const selectedProjects = [
    { id: 7, summary: 'Built an NLP pipeline to map citations between Mexican laws.' },
    { id: 32, title: 'Tree Atlas', summary: 'Organized document collections into topic hierarchies.' },
    { id: 16, summary: 'Built a system to compare candidate ATM locations in Mexico.' },
    { id: 10, title: 'Player2Vec', summary: 'Used a transformer to learn representations of football players and events.' },
    { id: 30, summary: 'Used census data to identify where formalization policies could help.' },
    { id: 14, summary: 'Turned scanned public transport records into mapped routes.' },
    { id: 34, summary: 'Mapped campus rooms and linked faculty to publications and research topics.' },
];

const projectTitles = new Map(homeProjects.map(project => [project.id, project.title]));
const projectLinkState = { returnTo: '/tldr' };

export default function Tldr() {
    useEffect(() => {
        document.title = `${profile.name} · TLDR`;
    }, []);

    const { publication } = profile;

    return (
        <main className="tldr-page">
            <div className="tldr-content">
                <header className="tldr-header">
                    <h1>{profile.name}</h1>
                    <TldrToggle enabled />
                    <p className="tldr-meta">{profile.role}</p>
                    <nav aria-label="Site links">
                        <a href="/home/harry-gomar-cv.pdf" download="Rafael Harry Gomar Dawson - CV.pdf">CV (PDF)</a>
                        <a href={profile.github}>GitHub</a>
                        <a href={`mailto:${profile.email}`}>Email</a>
                    </nav>
                </header>

                <section>
                    <h2>Positions</h2>
                    <ul>
                        {profile.experience.map(({ organization, role, dates, url }) => (
                            <li key={organization}>
                                <strong>{role}</strong>, {url ? <a href={url}>{organization}</a> : organization}
                                <span className="tldr-meta"> · {dates}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section>
                    <h2>Selected projects</h2>
                    <ul>
                        {selectedProjects.map(({ id, title, summary }) => (
                            <li key={id}>
                                <Link to={`/projects/${id}`} state={projectLinkState}>{title ?? projectTitles.get(id)}</Link>. {summary}
                            </li>
                        ))}
                        <li><a href="/art-atlas/">Art Atlas</a>. An interactive study of painting preferences.</li>
                    </ul>
                </section>

                <section>
                    <h2>Publications</h2>
                    <p><a href={publication.url}>{publication.title}</a></p>
                    <p className="tldr-meta">{publication.authors}</p>
                    <p className="tldr-meta">{publication.shortVenue}</p>
                </section>

                <section>
                    <h2>Talks</h2>
                    <ul>
                        {profile.talks.map(talk => (
                            <li key={talk.title}>
                                <strong>{talk.shortTitle || talk.title}</strong>
                                <div className="tldr-meta">
                                    {talk.seriesUrl ? <a href={talk.seriesUrl}>{talk.series}</a> : talk.series}
                                    {' · '}{talk.institution}
                                    {talk.date && ` · ${talk.date}`}
                                    {talk.poster && (
                                        <> · <a href={talk.poster} aria-label={`${talk.shortTitle || talk.title} poster`}>Poster</a></>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                <section>
                    <h2>Teaching</h2>
                    <p><Link to="/projects/31" state={projectLinkState}>MIT IAP and MIT Sloan</Link>. {profile.teaching}</p>
                </section>

                <section>
                    <h2>Recognition</h2>
                    <ul>
                        {profile.recognition.map(item => <li key={item}>{item}</li>)}
                    </ul>
                </section>
            </div>
        </main>
    );
}
