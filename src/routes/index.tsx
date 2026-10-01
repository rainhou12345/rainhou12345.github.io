import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Download, Linkedin, Mail, Maximize2, Menu, Minimize2, Moon, Pause, Play, Send, Sun, X } from 'lucide-react'
import { portfolio as p } from '../portfolio-data'
import { InteractiveBrain } from '../components/InteractiveBrain'

export const Route = createFileRoute('/')({ component: Portfolio })
const id = (label: string) => label.toLowerCase().replace(/\s+/g, '-')

function SectionTitle({eyebrow,title,aside}:{eyebrow:string;title:string;aside?:string}) { return <header className="section-title"><span>{eyebrow}</span><h2>{title}</h2>{aside&&<p>{aside}</p>}</header> }

function VoltageAngleModel() {
  const [voltage, setVoltage] = useState(121)
  const angle1 = 90 * ((1 - Math.exp(-0.01 * voltage)) / (1 - Math.exp(-2.55)))
  const angle2 = (10 / 9) * angle1
  const radians = (value:number) => value * Math.PI / 180
  const base = { x: 270, y: 82 }
  const middle = { x: base.x + 120 * Math.cos(radians(angle1)), y: base.y + 120 * Math.sin(radians(angle1)) }
  const tip = { x: middle.x + 102 * Math.cos(radians(angle1 + angle2)), y: middle.y + 102 * Math.sin(radians(angle1 + angle2)) }
  return <figure className="voltage-model"><div className="voltage-plot"><div className="model-readout"><span>LIVE KINEMATIC MODEL</span><b>{voltage.toFixed(voltage % 1 ? 1 : 0)} V</b></div><svg viewBox="0 0 560 330" role="img" aria-label={`Robotic finger at ${angle1.toFixed(2)} degrees for the first joint and ${angle2.toFixed(2)} degrees for the second joint`}><line className="model-base model-base-wide" x1="42" y1={base.y} x2={base.x} y2={base.y}/><line className="model-base model-base-core" x1="42" y1={base.y} x2={base.x} y2={base.y}/><line className="finger-link" x1={base.x} y1={base.y} x2={middle.x} y2={middle.y}/><line className="finger-link" x1={middle.x} y1={middle.y} x2={tip.x} y2={tip.y}/>{[base,middle,tip].map((point,i)=><g key={i} className="model-joint"><circle cx={point.x} cy={point.y} r="12"/><circle cx={point.x} cy={point.y} r="5"/></g>)}</svg></div><div className="voltage-controls"><label htmlFor="voltage-slider"><span>Input voltage</span><b>{voltage.toFixed(voltage % 1 ? 1 : 0)} V</b></label><input id="voltage-slider" type="range" min="0" max="255" step="0.5" value={voltage} onChange={e=>setVoltage(Number(e.target.value))}/><div className="slider-limits"><span>0 V</span><span>255 V</span></div><div className="angle-values"><div><span>Angle 1</span><b>{angle1.toFixed(2)}°</b></div><div><span>Angle 2</span><b>{angle2.toFixed(2)}°</b></div></div></div><figcaption>Voltage-to-angle response for a two-joint robotic finger.</figcaption></figure>
}

function ProjectImage({src,alt,caption}:{src:string;alt:string;caption:string}) { return <figure className="project-image"><img src={src} alt={alt}/><figcaption>{caption}</figcaption></figure> }

function EmbeddedSimulation({path,title,allowCamera=false}:{path:string;title:string;allowCamera?:boolean}) {
  const [loaded,setLoaded] = useState(false)
  const [error,setError] = useState(false)
  const [fullscreen,setFullscreen] = useState(false)
  const shell = useRef<HTMLDivElement>(null)
  useEffect(()=>{const sync=()=>setFullscreen(document.fullscreenElement===shell.current);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[])
  const toggleFullscreen = async() => {if(document.fullscreenElement)await document.exitFullscreen();else await shell.current?.requestFullscreen()}
  const kind = path.includes('robotic-hand')?'hand-frame':'epicyon-frame'
  return <div ref={shell} className={`simulation-frame-shell ${kind}`}><button type="button" className="fullscreen-control" onClick={toggleFullscreen} aria-label={`${fullscreen?'Exit':'Open'} ${title} fullscreen`}>{fullscreen?<Minimize2/>:<Maximize2/>}<span>{fullscreen?'Exit fullscreen':'Fullscreen'}</span></button><iframe src={path} title={title} allow={allowCamera?'camera':undefined} loading="lazy" onLoad={()=>setLoaded(true)} onError={()=>setError(true)}/>{!loaded&&<div className="simulator-status" role="status">{error?`${title} could not load. Refresh the page to try again.`:`Loading ${title}`}</div>}</div>
}

const tracks = [
  { title: 'Faith', src: '/media/music/faith.mp3' },
  { title: 'Feels So Wrong', src: '/media/music/feels-so-wrong.mp3' },
  { title: 'M&X', src: '/media/music/m-and-x.mp3' },
  { title: 'Out of Breath', src: '/media/music/out-of-breath.mp3' },
  { title: 'Tranxend', src: '/media/music/tranxend.mp3' },
  { title: 'Victour', src: '/media/music/victour.mp3' },
]

const formatTime = (seconds:number) => Number.isFinite(seconds) ? `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}` : '0:00'

function AudioTrack({track,index,active,onToggle,onEnded}:{track:(typeof tracks)[number];index:number;active:boolean;onToggle:()=>void;onEnded:()=>void}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [duration,setDuration] = useState(0)
  const [current,setCurrent] = useState(0)
  const syncDuration = (player:HTMLAudioElement) => {
    const value = Number.isFinite(player.duration) ? player.duration : player.seekable.length ? player.seekable.end(player.seekable.length-1) : 0
    setDuration(value)
  }
  useEffect(()=>{
    const player = audio.current
    if(!player)return
    if(active)player.play().catch(()=>{})
    else player.pause()
  },[active])
  useEffect(()=>{
    if(!active)return
    let frame = 0
    const update = () => {if(audio.current)setCurrent(audio.current.currentTime);frame=requestAnimationFrame(update)}
    frame=requestAnimationFrame(update)
    return ()=>cancelAnimationFrame(frame)
  },[active])
  const seek = (value:number) => {if(!audio.current||!duration)return;audio.current.currentTime=value;setCurrent(value)}
  const progress = duration ? Math.min(current/duration,1) : 0
  return <article className={`audio-track${active?' playing':''}`}><audio ref={audio} src={track.src} preload="metadata" onLoadedMetadata={e=>syncDuration(e.currentTarget)} onDurationChange={e=>syncDuration(e.currentTarget)} onProgress={e=>syncDuration(e.currentTarget)} onTimeUpdate={e=>setCurrent(e.currentTarget.currentTime)} onEnded={onEnded}/><button type="button" className="track-toggle" onClick={onToggle} aria-label={`${active?'Pause':'Play'} ${track.title}`}>{active?<Pause/>:<Play/>}</button><div className="track-main"><div className="track-heading"><span>{String(index+1).padStart(2,'0')}</span><b>{track.title}</b><time>{formatTime(current)} / {formatTime(duration)}</time></div><div className="track-wave"><i aria-hidden="true" style={{transform:`scaleX(${progress})`}}/><input aria-label={`Seek ${track.title}`} type="range" min="0" max={duration||1} step="0.1" value={Math.min(current,duration||0)} disabled={!duration} onInput={e=>seek(Number(e.currentTarget.value))}/></div></div></article>
}

function RobotSimulation() {
  const points = [
    ['EPICYON SIMULATION', 'Interactive 3D representation of the physical quadruped with articulated joints, movement sequences, obstacles, and sensor feedback.'],
    ['KINEMATICS', 'Multi-link leg geometry and coordinated lateral hip, hip, and knee motion used to model and control leg movement.'],
    ['REAL HARDWARE', 'The digital robot represents the architecture of the robot I physically built, including MG90S servos, custom 3D-printed components, electronics, sensors, wiring, and battery hardware.'],
    ['TORQUE ANALYSIS', 'Joint loads are estimated using component masses, joint positions, lever arms, and the downstream mass supported or moved by each actuator.'],
  ]
  return <div className="robot-simulation"><div className="simulation-intro"><div><span>INTERACTIVE ROBOTIC SIMULATION</span><h4>Built in hardware.<br/>Understood in motion.</h4></div><p>Drag to inspect Epicyon, run its movement sequences, and watch live load estimates respond. The simulation mirrors the architecture of my physical build and adds an obstacle-sensing motion lab.</p></div><div className="simulator-viewport"><EmbeddedSimulation path="/epicyon-simulation/" title="Epicyon interactive 13-DOF robotic dog simulator"/></div><div className="simulation-points">{points.map(([title,text],i)=><div key={title}><span>0{i+1}</span><b>{title}</b><p>{text}</p></div>)}</div></div>
}

function HandSimulation() {
  return <div className="hand-simulation"><div className="simulation-intro"><div><span>CAMERA-CONTROLLED 3D HAND</span><h4>Your move.<br/>The robot counters.</h4></div><p>Enable the camera, show rock, paper, or scissors, and watch the custom 16-part robotic hand animate the winning response. Drag the model to inspect its mechanical assembly.</p></div><div className="simulator-viewport hand-viewport"><EmbeddedSimulation path="/robotic-hand/" title="Vision-controlled rock paper scissors robotic hand" allowCamera/></div></div>
}

function Portfolio() {
  const [dark,setDark]=useState(true), [menu,setMenu]=useState(false), [playing,setPlaying]=useState<number|null>(null), [sent,setSent]=useState<'idle'|'sending'|'sent'|'error'>('idle')
  useEffect(()=>{const saved=localStorage.getItem('theme');const value=saved?saved==='dark':!matchMedia('(prefers-color-scheme: light)').matches;setDark(value);document.documentElement.dataset.theme=value?'dark':'light'},[])
  const toggleTheme=()=>{const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';localStorage.setItem('theme',next?'dark':'light')}
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setSent('sending');const form=e.currentTarget;try{const data=new URLSearchParams();new FormData(form).forEach((v,k)=>data.append(k,String(v)));const res=await fetch('/__forms.html',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data.toString()});if(!res.ok)throw new Error();setSent('sent');form.reset()}catch{setSent('error')}}
  return <><a className="skip" href="#main">Skip to content</a><nav className="nav" aria-label="Primary navigation"><a href="#home" className="mark" aria-label="Rain Hou, home"><b>RH</b><span>YUFENG HOU<br/>ENGINEERING / 2026</span></a><div className={menu?'navlinks open':'navlinks'}>{p.nav.map(n=><a key={n} href={`#${id(n)}`} onClick={()=>setMenu(false)}>{n}</a>)}</div><div className="nav-actions"><button onClick={toggleTheme} aria-label={`Switch to ${dark?'light':'dark'} mode`}>{dark?<Sun/>:<Moon/>}</button><button className="menu-btn" onClick={()=>setMenu(!menu)} aria-label="Toggle menu">{menu?<X/>:<Menu/>}</button></div></nav>
  <main id="main"><section id="home" className="hero section"><div className="hero-copy"><div className="availability"><i/> Vancouver, BC <span>AVAILABLE FOR COLLABORATION</span></div><p className="overline">ROBOTICS / AUTOMATION / DESIGN</p><h1>Yufeng <em>“Rain”</em><br/>Hou<span>.</span></h1><p className="role">{p.profile.title}</p><p className="tagline">{p.profile.tagline}</p><p className="intro">{p.profile.intro}</p><div className="hero-actions"><a className="btn primary" href="#projects">View projects <ArrowDownRight/></a><a className="btn" href="/Yufeng_Hou_Resume.pdf" target="_blank" rel="noreferrer"><Download/> View résumé</a><a className="btn" href="#contact">Contact me</a></div><div className="socials"><a href="https://www.linkedin.com/in/yufeng-hou-933535365/" target="_blank" rel="noreferrer"><Linkedin/> LinkedIn</a><a href={`mailto:${p.profile.email}`}><Mail/> Email</a></div></div><InteractiveBrain/></section>
  <section id="about" className="section about"><SectionTitle eyebrow="01 / About" title="Curious about almost everything."/><div className="about-grid"><div className="portrait-wrap"><img src="/yufeng-hou-portrait.jpg" alt="Formal portrait of Yufeng Rain Hou"/><span>YUFENG “RAIN” HOU<br/>VANCOUVER / BEIJING</span></div><div><div className="about-copy">{p.about.map(paragraph=><p key={paragraph}>{paragraph}</p>)}</div><div className="stats"><div><strong>22</strong><span>DoF hand systems</span></div><div><strong>2</strong><span>Working languages</span></div><div><strong>2029</strong><span>Expected graduation</span></div></div></div></div><div className="education">{p.education.map((e,i)=><article key={e.school}><span>0{i+1}</span><div><h3>{e.school}</h3><p>{e.credential}</p><small>{e.date}</small><p>{e.details}</p></div></article>)}</div></section>
  <section id="experience" className="section experience"><SectionTitle eyebrow="02 / Experience" title="Robotics, tested in the real world." aside="Engineering analysis meets clear international communication."/><div className="exp-head"><div><span>{p.experience.date}</span><h3>{p.experience.role}</h3><p>{p.experience.company} · {p.experience.place}</p></div><p>{p.experience.summary}</p></div><div className="exp-body"><ol>{p.experience.points.map((x,i)=><li key={x}><span>{String(i+1).padStart(2,'0')}</span><p>{x}</p></li>)}</ol><aside><p>PROJECT SPOTLIGHTS</p>{p.experience.spotlights.map((s,i)=><div key={s}><b>0{i+1}</b>{s}</div>)}<VoltageAngleModel/></aside></div></section>
  <section id="projects" className="section"><SectionTitle eyebrow="03 / Selected projects" title="Built, tested, improved." aside="Completed work and working systems—projects I can explain, demonstrate, and keep developing."/><div className="projects">{p.projects.map((x,i)=><article key={x.title} className={i===0?'featured':x.title==='Vision-Controlled Robotic Hand'?'hand-featured':''}><div className="project-top"><span>{x.n}</span><span>{x.status}</span></div><h3>{x.title}</h3><p>{x.text}</p>{x.details&&<div className="project-demo"><div className="project-demo-grid">{x.details.map((detail,j)=><span key={detail}><b>0{j+1}</b>{detail}</span>)}</div><small>Camera access starts only after you enable it.</small></div>}{i===0?<><ProjectImage src="/quadruped-robot.png" alt="CAD rendering of the completed 13-DOF quadruped robot" caption="13-DOF quadruped / mechanical architecture and physical build."/><RobotSimulation/></>:x.title==='Vision-Controlled Robotic Hand'?<HandSimulation/>:x.title==='Automatic Retrieval System'?<ProjectImage src="/media/projects/automatic-retrieval-system.webp" alt="Physical prototype of the automatic retrieval system with servos, wiring, ultrasonic sensors, and retrieval mechanism" caption="Automatic retrieval system / working electromechanical prototype."/>:x.title==='Accessible Seed-Planting Device'?<ProjectImage src="/media/projects/accessible-seed-planter.webp" alt="CAD rendering of the accessible seed-planting device being used from a wheelchair" caption="Accessible seed planter / human-centred CAD concept."/>:null}</article>)}</div></section>
  <section id="skills" className="section skills"><SectionTitle eyebrow="04 / Technical toolkit" title="Capabilities, honestly calibrated."/><div className="skill-list">{p.skills.map((s,i)=><article key={s.name}><div><span>0{i+1}</span><h3>{s.name}</h3><small>{s.level}</small></div><p>{s.items.map(x=><span key={x}>{x}</span>)}</p></article>)}</div></section>
  <section id="music" className="section creative"><SectionTitle eyebrow="05 / Music production" title="Sound, built layer by layer." aside="A creative practice in arrangement, texture, timing, and careful listening."/><div className="music-feature"><div><span>ORIGINAL PRODUCTION / FL STUDIO</span><h3>Another way I make systems.</h3></div><div><p>I produce original instrumentals across hip-hop, R&amp;B, atmospheric, psychedelic, and experimental styles. The process moves between sound selection, arrangement, audio editing, mixing, and collaboration—technical decisions in service of a feeling.</p><p>Music gives me a different space to iterate: less constrained than engineering, but just as attentive to structure, detail, and how individual parts work together.</p></div></div><div className="track-list">{tracks.map((track,i)=><AudioTrack key={track.src} track={track} index={i} active={playing===i} onToggle={()=>setPlaying(playing===i?null:i)} onEnded={()=>setPlaying(null)}/>)}</div><div className="music-process" aria-label="Music production process"><span>01 / COMPOSE</span><span>02 / ARRANGE</span><span>03 / MIX</span><span>04 / REFINE</span></div></section>
  <section id="beyond-engineering" className="section hobbies"><SectionTitle eyebrow="06 / Beyond engineering" title="Four ways I reset." aside="Creative work, movement, discipline, and strategy keep life broader than engineering."/><div className="interest-cloud">{p.interests.map((x,i)=><span key={x} className={i===0?'accent':''}>{x}</span>)}</div><div className="beyond-layout"><div className="beyond-notes"><p><b>MUSIC PRODUCTION</b> Original instrumentals, arrangement, mixing, and sound design.</p><p><b>SKIING</b> A long-running practice in confidence, control, and reading terrain.</p><p><b>STRENGTH TRAINING</b> Consistency, measurable progress, and patience over time.</p><p><b>CHESS</b> Pattern recognition, planning, and learning from bad positions.</p></div><figure className="ski-photo"><img src="/media/personal/skiing.webp" alt="Yufeng Hou skiing through deep snow on a mountain slope"/><figcaption>SKIING / MOUNTAINS, MOMENTUM, AND A CLEAR HEAD</figcaption></figure></div></section>
  <section id="contact" className="section contact"><div className="contact-copy"><span>07 / CONTACT</span><h2>Let’s build<br/>something<span>.</span></h2><p>Reach out about robotics, engineering design, research, automation, music technology, or a collaborative project.</p><a href={`mailto:${p.profile.email}`}>{p.profile.email} <ArrowUpRight/></a><small>{p.profile.location}</small><div className="contact-links"><a className="btn" href="/Yufeng_Hou_Resume.pdf" target="_blank" rel="noreferrer"><Download/> View résumé</a><a className="btn" href="https://www.linkedin.com/in/yufeng-hou-933535365/" target="_blank" rel="noreferrer"><Linkedin/> LinkedIn</a></div></div><form name="contact" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" onSubmit={submit}><input type="hidden" name="form-name" value="contact"/><p className="hidden"><label>Do not fill this out<input name="bot-field"/></label></p><label>Name<input required name="name" autoComplete="name" placeholder="Your name"/></label><label>Email<input required type="email" name="email" autoComplete="email" placeholder="you@company.com"/></label><label>Subject<input required name="subject" placeholder="What are you working on?"/></label><label>Message<textarea required name="message" rows={5} placeholder="Tell me a little about the project..."/></label><button className="btn primary" disabled={sent==='sending'}>{sent==='sending'?'Sending…':sent==='sent'?'Message sent':'Send message'} {sent==='sent'?<CheckCircle2/>:<Send/>}</button>{sent==='error'&&<p role="alert" className="form-error">Something went wrong. Please email me directly.</p>}</form></section></main>
  <footer><a href="#home" className="mark"><b>RH</b></a><p>Yufeng “Rain” Hou<br/><span>Engineering · Robotics · Creative technology</span></p><div>{p.nav.slice(0,5).map(n=><a key={n} href={`#${id(n)}`}>{n}</a>)}</div><p>© {new Date().getFullYear()} Yufeng Hou</p></footer></>
}
