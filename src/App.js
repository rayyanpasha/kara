import React, { useState, useEffect, useRef } from 'react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, orderBy, doc, updateDoc, increment } from 'firebase/firestore';

// --- Three.js ---
import * as THREE from 'three';

// --- GSAP ---
// GSAP and ScrollTrigger are loaded from a script tag in the final HTML,
// so we access them from the window object.

// --- SVG Icons ---
const MapPinIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-slate-400"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const CameraIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>;
const SpinnerIcon = () => <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const ArrowUpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M12 3a6 6 0 0 0 9 9a6 6 0 0 0-9-9Z"/><path d="M12 3a6 6 0 0 1-9 9a6 6 0 0 1 9-9Z"/></svg>;


// --- Helper Functions ---
const getAqiInfo = (aqi) => {
  if (aqi <= 50) return { level: 'Good', color: 'bg-green-500', textColor: 'text-green-500' };
  if (aqi <= 100) return { level: 'Moderate', color: 'bg-yellow-500', textColor: 'text-yellow-500' };
  if (aqi <= 150) return { level: 'Unhealthy for Sensitive Groups', color: 'bg-orange-500', textColor: 'text-orange-500' };
  if (aqi <= 200) return { level: 'Unhealthy', color: 'bg-red-500', textColor: 'text-red-500' };
  if (aqi <= 300) return { level: 'Very Unhealthy', color: 'bg-purple-500', textColor: 'text-purple-500' };
  return { level: 'Hazardous', color: 'bg-red-700', textColor: 'text-red-700' };
};
const getStatusColor = (status) => {
    switch (status) {
        case 'Received': return 'bg-blue-500/20 text-blue-300';
        case 'In Review': return 'bg-yellow-500/20 text-yellow-300';
        case 'Action Taken': return 'bg-green-500/20 text-green-300';
        default: return 'bg-slate-500/20 text-slate-300';
    }
};

// --- 3D Background Component ---
const ThreeBackground = () => {
    const mountRef = useRef(null);
    useEffect(() => {
        const mount = mountRef.current;
        let scene, camera, renderer, earthGroup, stars;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
        camera.position.z = 5;
        renderer = new THREE.WebGLRenderer({ canvas: mount, antialias: true, alpha: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 3, 5);
        scene.add(directionalLight);
        earthGroup = new THREE.Group();
        scene.add(earthGroup);
        const textureLoader = new THREE.TextureLoader();
        const earthGeometry = new THREE.SphereGeometry(1.5, 64, 64);
        const earthMaterial = new THREE.MeshPhongMaterial({ map: textureLoader.load('https://raw.githubusercontent.com/jscastro76/three-js-earth/master/src/img/earthmap.jpg'), bumpMap: textureLoader.load('https://raw.githubusercontent.com/jscastro76/three-js-earth/master/src/img/earthbump.jpg'), bumpScale: 0.05 });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earthGroup.add(earth);
        const cloudGeometry = new THREE.SphereGeometry(1.53, 64, 64);
        const cloudMaterial = new THREE.MeshPhongMaterial({ map: textureLoader.load('https://raw.githubusercontent.com/jscastro76/three-js-earth/master/src/img/earthcloud.png'), transparent: true, opacity: 0.6 });
        const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        earthGroup.add(clouds);
        const atmosphereGeometry = new THREE.SphereGeometry(1.6, 64, 64);
        const atmosphereMaterial = new THREE.ShaderMaterial({ vertexShader: `varying vec3 vertexNormal; void main() { vertexNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`, fragmentShader: `varying vec3 vertexNormal; void main() { float intensity = pow(0.6 - dot(vertexNormal, vec3(0, 0, 1.0)), 2.0); gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity; }`, blending: THREE.AdditiveBlending, side: THREE.BackSide });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        earthGroup.add(atmosphere);
        const starVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000; const y = (Math.random() - 0.5) * 2000; const z = (Math.random() - 0.5) * 2000;
            if (Math.sqrt(x * x + y * y + z * z) > 100) starVertices.push(x, y, z);
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0.8 });
        stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);
        const animate = () => { requestAnimationFrame(animate); earth.rotation.y += 0.0005; clouds.rotation.y += 0.0004; stars.rotation.y += 0.0001; renderer.render(scene, camera); };
        animate();
        
        if (window.gsap && window.ScrollTrigger) {
            const gsap = window.gsap;
            gsap.registerPlugin(window.ScrollTrigger);
            
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: "main",
                    start: "top top",
                    end: "bottom+=400%",
                    scrub: 2,
                }
            });

            tl.to(earthGroup.scale, { x: 1.8, y: 1.8, z: 1.8 })
              .to(camera.position, { z: 4 }, "<")
              .to(earthGroup.position, { x: 0, y: 0, z: 0 }, "<");
            
            tl.to(earthGroup.position, { x: -3, y: 0, z: -1 }, ">")
              .to(earthGroup.scale, { x: 0.9, y: 0.9, z: 0.9 }, "<")
              .to(earthGroup.rotation, { y: Math.PI * 0.5 }, "<");
            
            tl.to(earthGroup.position, { x: 3, y: 0, z: 0 }, ">")
              .to(earthGroup.scale, { x: 1.2, y: 1.2, z: 1.2 }, "<")
              .to(earthGroup.rotation, { y: Math.PI, z: 0.2 }, "<");
            
            tl.to(earthGroup.position, { x: 0, y: 2.5, z: -4 }, ">")
              .to(earthGroup.scale, { x: 0.7, y: 0.7, z: 0.7 }, "<")
              .to(earthGroup.rotation, { y: Math.PI * 1.5, z: -0.2 }, "<");
            
            tl.to(earthGroup.position, { x: -3, y: -1, z: 0 }, ">")
              .to(earthGroup.scale, { x: 1, y: 1, z: 1 }, "<")
              .to(earthGroup.rotation, { y: Math.PI * 2 }, "<");
            
            tl.to(earthGroup.position, { x: 0, y: 0, z: 0 }, ">")
              .to(earthGroup.scale, { x: 2.5, y: 2.5, z: 2.5 }, "<")
              .to(camera.position, { z: 6 }, "<");
        }

        const handleResize = () => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); if (renderer.domElement.parentElement === mount) { mount.removeChild(renderer.domElement); } };
    }, []);
    return <canvas ref={mountRef} id="bg-canvas" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 0 }} />;
};

// --- UI Components ---
const Header = () => ( <header className="bg-slate-900/70 backdrop-blur-lg sticky top-0 z-50 border-b border-slate-700"><nav className="container mx-auto px-6 py-4 flex justify-between items-center"><a href="#home" className="text-2xl font-bold text-white">Kara</a><div className="hidden md:flex space-x-8 items-center"><a href="#dashboard" className="text-slate-300 hover:text-blue-400 transition">Dashboard</a><a href="#kit" className="text-slate-300 hover:text-blue-400 transition">The Kit</a><a href="#about" className="text-slate-300 hover:text-blue-400 transition">About Us</a></div></nav></header> );
const AQIDisplay = ({ apiKey }) => {
  const [aqiData, setAqiData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const [healthTips, setHealthTips] = useState('');
  const [tipsLoading, setTipsLoading] = useState(false);

  useEffect(() => { const fetchAqi = async () => { try { const response = await fetch('https://api.waqi.info/feed/bengaluru/?token=demo'); const data = await response.json(); if (data.status === 'ok') { const p = {}; if (data.data.iaqi.pm25) p.pm25 = { value: data.data.iaqi.pm25.v, name: "PM2.5" }; if (data.data.iaqi.pm10) p.pm10 = { value: data.data.iaqi.pm10.v, name: "PM10" }; if (data.data.iaqi.o3) p.o3 = { value: data.data.iaqi.o3.v, name: "Ozone" }; setAqiData({ city: data.data.city.name, aqi: data.data.aqi, pollutants: p }); } else { throw new Error(data.data); } } catch (err) { setError('Could not fetch AQI data.'); } finally { setLoading(false); } }; fetchAqi(); }, []);
  
  const handleGetHealthTips = async () => {
    if (!aqiData) return;
    setTipsLoading(true);
    setHealthTips('');
    const aqiInfo = getAqiInfo(aqiData.aqi);
    const prompt = `The current Air Quality Index (AQI) in Bengaluru is ${aqiData.aqi}, which is considered '${aqiInfo.level}'. Provide 3 concise, actionable health tips for a teenager who travels daily in this city. Focus on practical advice they can use today. Use emojis and format as a simple list.`;
    
    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API responded with an error:", response.status, errorText);
            throw new Error(`API request failed with status ${response.status}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            setHealthTips(result.candidates[0].content.parts[0].text);
        } else {
            console.error("Unexpected Gemini API response structure:", result);
            setHealthTips("Could not generate tips due to an unexpected response format.");
        }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        setHealthTips("An error occurred while fetching health tips. Check the console for details.");
    } finally {
        setTipsLoading(false);
    }
  };

  if (loading) return <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center"><div className="animate-pulse"><div className="h-8 bg-slate-700 rounded w-3/4 mx-auto mb-4"></div><div className="h-20 bg-slate-700 rounded-full w-20 mx-auto mb-4"></div><div className="h-6 bg-slate-700 rounded w-1/2 mx-auto"></div></div></div>;
  if (error) return <div className="bg-slate-800/50 p-6 rounded-2xl border border-red-500/50 text-center text-red-400">{error}</div>;
  
  const aqiInfo = getAqiInfo(aqiData.aqi);
  return (<div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-center"><div className="flex items-center justify-center text-slate-400 text-lg mb-4"><MapPinIcon /><span>{aqiData.city}</span></div><div className={`mx-auto w-32 h-32 rounded-full flex items-center justify-center text-white text-5xl font-bold mb-4 ${aqiInfo.color}`}>{aqiData.aqi}</div><h3 className={`text-2xl font-bold ${aqiInfo.textColor}`}>{aqiInfo.level}</h3><div className="mt-6 pt-6 border-t border-slate-700 flex justify-around text-white">{Object.values(aqiData.pollutants).map(p => (<div key={p.name}><div className="text-2xl font-semibold">{p.value}</div><div className="text-xs text-slate-400">{p.name}</div></div>))}</div>
  <button onClick={handleGetHealthTips} disabled={tipsLoading} className="mt-6 w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors duration-300 flex items-center justify-center disabled:bg-slate-500">{tipsLoading ? <SpinnerIcon /> : <><SparklesIcon /> Get Health Tips</>}</button>
  {healthTips && <div className="mt-4 text-left text-sm text-slate-300 bg-slate-700/50 p-3 rounded-lg whitespace-pre-wrap">{healthTips}</div>}
  </div>);
};

const ComplaintForm = ({ db, auth, apiKey }) => {
  const [description, setDescription] = useState(''); const [location, setLocation] = useState(''); const [category, setCategory] = useState(''); const [isSubmitting, setIsSubmitting] = useState(false); const [message, setMessage] = useState('');
  const [aiContent, setAiContent] = useState({ summary: '', draft: '' });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAIDraft = async () => {
    if (!description || !location || !category) {
        setMessage("Please fill in location, category, and description before generating.");
        return;
    }
    setIsGenerating(true);
    setAiContent({ summary: '', draft: '' });
    const prompt = `Based on the following pollution complaint, generate a short, one-sentence summary and a formal complaint draft. Format the output as a JSON object with two keys: "summary" and "draft".\n\nComplaint Category: ${category}\nLocation: ${location}\nDescription: ${description}`;
    try {
        let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API responded with an error:", response.status, errorText);
            throw new Error(`API request failed with status ${response.status}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            let textContent = result.candidates[0].content.parts[0].text;
            textContent = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                const parsedResult = JSON.parse(textContent);
                setAiContent(parsedResult);
            } catch (parseError) {
                console.error("Failed to parse Gemini response JSON:", parseError, "Raw text:", textContent);
                setMessage("AI generated an invalid response format.");
            }
        } else {
            console.error("Unexpected Gemini API response structure:", result);
            setMessage("Could not generate AI content due to an unexpected response.");
        }
    } catch (error) { console.error("Gemini API call failed:", error); setMessage("Failed to connect to the AI service. Check the console."); }
    finally { setIsGenerating(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !location || !category || !auth.currentUser) { setMessage('Please fill in all fields.'); return; }
    setIsSubmitting(true); setMessage('');
    try {
      await addDoc(collection(db, `complaints`), {
        userId: auth.currentUser.uid, description, location, category, status: 'Received', upvotes: 0, timestamp: serverTimestamp(),
      });
      setDescription(''); setLocation(''); setCategory(''); setAiContent({ summary: '', draft: '' }); setMessage('Report submitted successfully!');
    } catch (error) { console.error("Error adding document: ", error); setMessage('Failed to submit report.'); } 
    finally { setIsSubmitting(false); setTimeout(() => setMessage(''), 3000); }
  };
  return (<div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700"><h3 className="text-2xl font-bold text-white mb-4">Report an Issue</h3><form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="location" className="block text-sm font-medium text-slate-300 mb-1">Location</label><input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g., Near MG Road Metro Station" className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" /></div><div><label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Category</label><select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"><option value="">Select Category</option><option>Waste Burning</option><option>Industrial Emissions</option><option>Vehicular Smoke</option><option>Construction Dust</option></select></div><div><label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">Description</label><textarea id="description" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"></textarea></div>
  {description && <button type="button" onClick={handleGenerateAIDraft} disabled={isGenerating} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center disabled:bg-slate-500">{isGenerating ? <SpinnerIcon /> : <><SparklesIcon /> Generate AI Summary & Draft</>}</button>}
  {aiContent.summary && <div className="bg-slate-700/50 p-3 rounded-lg"><p className="text-sm font-semibold text-indigo-300">AI Summary:</p><p className="text-sm text-slate-300 italic">{aiContent.summary}</p></div>}
  {aiContent.draft && <div className="bg-slate-700/50 p-3 rounded-lg"><p className="text-sm font-semibold text-indigo-300">AI Drafted Complaint:</p><p className="text-sm text-slate-300 whitespace-pre-wrap">{aiContent.draft}</p></div>}
  <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 flex items-center justify-center disabled:bg-slate-500">{isSubmitting ? <SpinnerIcon /> : 'Submit Complaint'}</button>{message && <p className="text-sm text-center text-green-400 mt-2">{message}</p>} </form></div>);
};
const ComplaintFeed = ({ complaints, db }) => {
    const handleUpvote = async (id) => {
        const complaintRef = doc(db, `complaints`, id);
        try { await updateDoc(complaintRef, { upvotes: increment(1) }); } 
        catch (error) { console.error("Error upvoting: ", error); }
    };
    return (<div className="space-y-4">{complaints.length === 0 ? (<p className="text-slate-400 text-center py-8">No reports yet.</p>) : (complaints.map(c => (<div key={c.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700"><div className="flex justify-between items-start"><p className="text-white flex-1 pr-4">{c.description}</p><div className="flex flex-col items-center"><button onClick={() => handleUpvote(c.id)} className="flex items-center text-slate-400 hover:text-white transition-colors"><ArrowUpIcon /><span>{c.upvotes}</span></button><span className={`mt-2 text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(c.status)}`}>{c.status}</span></div></div><div className="text-xs text-slate-400 mt-2 flex justify-between items-center"><span className="flex items-center"><MapPinIcon /> {c.location}</span><span>{c.timestamp?.toDate().toLocaleString() || 'Just now'}</span></div></div>)))}</div>);
};
const DashboardTabs = ({ db, auth, complaints, userId }) => {
    const [activeTab, setActiveTab] = useState('feed');
    const myComplaints = complaints.filter(c => c.userId === userId);
    return (<div><div className="flex border-b border-slate-700 mb-6"><button onClick={() => setActiveTab('feed')} className={`py-2 px-4 font-semibold ${activeTab === 'feed' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}>Community Feed</button><button onClick={() => setActiveTab('my_reports')} className={`py-2 px-4 font-semibold ${activeTab === 'my_reports' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}>My Reports</button><button onClick={() => setActiveTab('map')} className={`py-2 px-4 font-semibold ${activeTab === 'map' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}>Complaint Map</button></div><div>{activeTab === 'feed' && <ComplaintFeed complaints={complaints} db={db} />}{activeTab === 'my_reports' && <ComplaintFeed complaints={myComplaints} db={db} />}{activeTab === 'map' && <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700"><h3 className="text-lg font-bold text-white mb-2">Pollution Hotspots</h3><img src="https://placehold.co/800x400/1e293b/475569?text=Heatmap+of+Pollution+Complaints" alt="Complaint Heatmap" className="rounded-lg w-full" /></div>}</div></div>);
};

export default function App() {
  const [firebase, setFirebase] = useState({ db: null, auth: null });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [complaints, setComplaints] = useState([]);
  
  // Define the Gemini API Key in one central place
  const GEMINI_API_KEY = "AIzaSyDn7yWMATzanguLxkihirfqbKWnAPJgZVQ"; // <-- IMPORTANT: PASTE YOUR KEY HERE

  useEffect(() => {
    const firebaseConfig = {
      apiKey: "AIzaSyCsLJrI1dJbmPyZ-HAFDFI6vh2Vhen4OD0",
      authDomain: "kara-ff66c.firebaseapp.com",
      projectId: "kara-ff66c",
      storageBucket: "kara-ff66c.appspot.com",
      messagingSenderId: "450627636310",
      appId: "1:450627636310:web:d6b21e85446eb55598bff7"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    setFirebase({ db, auth });

    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous sign-in failed:", error);
        }
      }
      setIsAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!firebase.db || !isAuthReady) return; 
    
    const q = query(collection(firebase.db, `complaints`), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const complaintsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setComplaints(complaintsData);
    }, (error) => {
        console.error("Firestore snapshot error:", error);
    });
    return () => unsubscribe();
  }, [firebase.db, isAuthReady]);

  return (
    <div className="bg-slate-900 text-white min-h-screen font-sans">
      <ThreeBackground />
      <div className="relative z-10">
        <Header />
        <main>
          <section id="home" className="content-section text-center"><div className="content-wrapper"><h1 className="text-5xl md:text-7xl font-extrabold text-white">Breathe Freely. Travel Safely.</h1><p className="text-xl text-slate-300 mt-4 max-w-3xl mx-auto">Kara is your personal pollution protection system. Get real-time alerts, report issues, and take control of your health.</p><a href="#dashboard" className="mt-8 inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-blue-700 transition-transform hover:scale-105">Go to Dashboard</a></div></section>
          <section id="dashboard" className="content-section"><div className="content-wrapper w-full max-w-6xl"><div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-1"><AQIDisplay apiKey={GEMINI_API_KEY} /><div className="mt-8"><ComplaintForm db={firebase.db} auth={firebase.auth} apiKey={GEMINI_API_KEY} /></div></div><div className="lg:col-span-2">{isAuthReady && firebase.db ? <DashboardTabs db={firebase.db} auth={firebase.auth} complaints={complaints} userId={firebase.auth.currentUser?.uid} /> : <div className="flex justify-center items-center h-full"><SpinnerIcon /></div>}</div></div></div></section>
          <section id="kit" className="content-section text-center"><div className="content-wrapper"><h2 className="text-4xl font-bold text-white mb-4">The Kara Protection Kit</h2><p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">Your first line of defense against urban pollution. The kit includes smart, reusable masks and a pocket-sized air quality sensor that syncs with the app.</p><div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 inline-block"><img src="https://placehold.co/600x400/1e293b/ffffff?text=Kara+Kit+Components" alt="Kara Kit" className="rounded-lg" /></div></div></section>
          <section id="about" className="content-section text-center"><div className="content-wrapper"><h2 className="text-4xl font-bold text-white mb-4">Our Team</h2><p className="text-lg text-slate-300 max-w-2xl mx-auto mb-12">We are a passionate team dedicated to empowering urban youth to take control of their health and environment with Kara.</p><div className="flex justify-center gap-8"><div className="text-center"><img src="https://placehold.co/150x150/1e293b/ffffff?text=R" alt="Rayyan" className="w-24 h-24 rounded-full mx-auto mb-2 border-2 border-blue-400"/><h3 className="text-xl font-bold text-white">Rayyan</h3><p className="text-blue-400">Co-Founder</p></div><div className="text-center"><img src="https://placehold.co/150x150/1e293b/ffffff?text=K" alt="Kanishka" className="w-24 h-24 rounded-full mx-auto mb-2 border-2 border-blue-400"/><h3 className="text-xl font-bold text-white">Kanishka</h3><p className="text-blue-400">Co-Founder</p></div></div></div></section>
          <section id="contact" className="content-section"><div className="content-wrapper"><h2 className="text-4xl font-bold text-white text-center mb-8">Join Our Mission</h2><form action="#" method="POST" className="max-w-lg mx-auto"><div className="grid grid-cols-1 gap-y-4"><input type="text" placeholder="Full name" className="bg-slate-800/50 block w-full py-3 px-4 placeholder-slate-400 rounded-md border border-slate-600 focus:ring-blue-500 focus:border-blue-500" /><input type="email" placeholder="Email" className="bg-slate-800/50 block w-full py-3 px-4 placeholder-slate-400 rounded-md border border-slate-600 focus:ring-blue-500 focus:border-blue-500" /><textarea rows="4" placeholder="Your Message" className="bg-slate-800/50 block w-full py-3 px-4 placeholder-slate-400 rounded-md border border-slate-600 focus:ring-blue-500 focus:border-blue-500"></textarea><button type="submit" className="w-full cta-button bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700">Send Message</button></div></form></div></section>
        </main>
        <footer className="relative z-20 text-center py-6 text-slate-500 text-sm">
          <p>&copy; 2025 Kara. An entry for the International Sastra Summit 2025.</p>
        </footer>
      </div>
    </div>
  );
}
