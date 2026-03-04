import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, CheckCircle2, Circle, ExternalLink, Download, ChevronDown, ChevronUp, List, Briefcase, X, Printer, Share2, PenLine } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Version number - update this when releasing new version
const APP_VERSION = '2.1.2';

// ─── Pole Record Wizard ────────────────────────────────────────────────────────

function PdfCanvasPreview({ pdfBytes }) {
  const containerRef = useRef(null);
  const renderingRef = useRef(false);
  useEffect(() => {
    if (!pdfBytes || !containerRef.current) return;
    if (renderingRef.current) return;
    renderingRef.current = true;
    const container = containerRef.current;
    container.innerHTML = '';
    const PDFJS_VERSION = '3.11.174';
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    (async () => {
      try {
        await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`);
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
        const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        const scale = window.devicePixelRatio >= 2 ? 2 : 1.5;
        for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 3); pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const wrapper = document.createElement('div');
          wrapper.style.cssText = `width:100%;background:#fff;${pageNum > 1 ? 'marginTop:8px;' : ''}`;
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          canvas.style.cssText = 'width:100%;display:block;';
          wrapper.appendChild(canvas); container.appendChild(wrapper);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
        renderingRef.current = false;
      } catch (err) { console.error('pdf.js render failed:', err); renderingRef.current = false; }
    })();
    return () => { renderingRef.current = false; };
  }, [pdfBytes]);
  return <div ref={containerRef} style={{width:'100%'}} />;
}

const W_STEPS = ["Location & Contractor","Pole IDs & GPS","Pole Details","Pole Code & Type","Equipment on Pole","Accessories","Conductors","Crossarms","Work Description","Preview & Print"];
const POLE_CODES = ["B9.5 (Busck)","B10.0 (Busck)","B10.5 (Busck)","B11.0 (Busck)","B12.4 (Busck)","B12.5 (Busck)","B13.65 (Busck)","B14.85 (Busck)","B15.5 (Busck)","B18.5 (Busck)","9m (9kN) Goldpine","10m (9kN) Goldpine","10m (12kN) Goldpine","11m (9kN) Goldpine","11m (12kN) Goldpine","12m (12kN) Goldpine"];
const PC_X = [45,173,295,427,45,173,295,427,45,173,295,427,45,173,295,427];
const PC_Y = [478,478,478,478,493,493,493,493,507,507,507,507,521,521,521,521];
const POLE_TYPES = ["1 Pole","1 \u00BD Pole","2 Pole","3 Pole","4 Pole","H Pole","Double","Stay Pole"];
const PT_X = [45,174,296,429,45,174,296,429];
const PT_Y = [610,610,610,610,624,624,624,624];
const W_PURPLE = "#4B2D8A", W_YELLOW = "#FFD700";
const wInp = { width:"100%", padding:"9px 11px", border:"2px solid #ddd", borderRadius:8, fontSize:15, fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:"#fafafa", color:"#222" };
const wLbl = { display:"block", fontSize:12, fontWeight:700, color:"#555", marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" };

function WF({label, v, set, type="text", ph}) {
  return <div style={{marginBottom:12}}><label style={wLbl}>{label}</label><input type={type} value={v||""} onChange={e=>set(e.target.value)} placeholder={ph} style={wInp} /></div>;
}
function WTA({label, v, set, rows=3, ph}) {
  return <div style={{marginBottom:12}}><label style={wLbl}>{label}</label><textarea value={v||""} onChange={e=>set(e.target.value)} rows={rows} placeholder={ph} style={{...wInp,height:"auto",resize:"vertical"}} /></div>;
}
function WCB({label, options, value, onChange, multi}) {
  return (
    <div style={{marginBottom:14}}>
      <label style={wLbl}>{label}</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
        {options.map(o => {
          const sel = multi ? (value||[]).includes(o) : value===o;
          return <button key={o} onClick={()=>onChange(o)} style={{padding:"7px 12px",borderRadius:8,border:`2px solid ${sel?W_PURPLE:"#ddd"}`,background:sel?W_PURPLE:"#fff",color:sel?"#fff":"#333",fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:sel?700:400}}>{o}</button>;
        })}
      </div>
    </div>
  );
}

async function generateFilledPdf(d) {
  const PAGE_H = 842;
  const BLUE = rgb(26/255, 26/255, 1);
  const existingPdfBytes = await fetch('forms/360S014EC.pdf').then(r => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const [p1, p2, p3] = pages;
  const t = (page, x, cssY, str, size=8.5) => {
    if (!str) return;
    page.drawText(String(str), { x, y: PAGE_H - cssY - size, size, font, color: BLUE });
  };
  const ck = (page, x, cssY, show) => {
    if (!show) return;
    const by = PAGE_H - cssY - 2;
    page.drawLine({ start:{x, y:by-6}, end:{x:x+3, y:by-9}, thickness:1.5, color:BLUE, opacity:1 });
    page.drawLine({ start:{x:x+3, y:by-9}, end:{x:x+9, y:by-1}, thickness:1.5, color:BLUE, opacity:1 });
  };
  t(p1,115,107,d.street); t(p1,395,107,d.contractor); t(p1,395,121,d.dateCompleted);
  t(p1,115,135,d.city); t(p1,395,135,d.signed); t(p1,115,150,d.district);
  t(p1,395,150,d.namePrint); t(p1,165,164,d.workorderNumber); t(p1,451,164,d.customerWorksNumber);
  t(p1,80,225,d.newPoleId); t(p1,260,225,d.oldPoleId); t(p1,415,220,d.gpsNorth);
  t(p1,415,234,d.gpsEast); t(p1,415,265,d.altitude); t(p1,80,273,d.manufacturerPoleId); t(p1,260,273,d.manufacturedDate);
  ck(p1,143,319,d.poleActivity==="New"); ck(p1,218,319,d.poleActivity==="Removed"); ck(p1,294,319,d.poleActivity==="Replaced"); ck(p1,386,319,d.poleActivity==="Relocation"); ck(p1,464,319,d.poleActivity==="Label Replaced");
  ck(p1,143,333,d.crossarmActivity==="New"); ck(p1,218,333,d.crossarmActivity==="Removed"); ck(p1,294,333,d.crossarmActivity==="Replaced");
  ck(p1,143,348,d.poleLoading==="Angle"); ck(p1,218,348,d.poleLoading==="In Line"); ck(p1,294,348,d.poleLoading==="Road Crossing"); ck(p1,386,348,d.poleLoading==="Take Off"); ck(p1,464,348,d.poleLoading==="Termination");
  ck(p1,143,362,d.gpsRequired==="Yes"); ck(p1,218,362,d.gpsRequired==="No");
  ck(p1,143,377,d.poleCondition==="New"); ck(p1,218,377,d.poleCondition==="Pre-Used");
  ck(p1,143,391,d.ownership==="Powerco"); ck(p1,218,391,d.ownership==="Private");
  if(d.ownership==="Other"){ck(p1,294,391,!!d.ownershipOther);t(p1,374,392,d.ownershipOther);}
  ck(p1,143,405,d.sharedUse==="Fibre"); ck(p1,218,405,d.sharedUse==="Chorus");
  if(d.sharedUse==="Other"){ck(p1,294,405,!!d.sharedUseOther);t(p1,374,406,d.sharedUseOther);}
  t(p1,128,420,d.reasonForRemoval);
  PC_X.forEach((x,i)=>ck(p1,x,PC_Y[i],d.poleCode===POLE_CODES[i]));
  ck(p1,45,537,!!d.dulhuntyCode); t(p1,232,539,d.dulhuntyCode);
  ck(p1,45,552,!!d.iupCode); t(p1,184,554,d.iupCode);
  ck(p1,45,568,!!d.otherCode); t(p1,232,570,d.otherCode);
  PT_X.forEach((x,i)=>ck(p1,x,PT_Y[i],d.poleType===POLE_TYPES[i]));
  if(d.poleType==="Other"){ck(p1,45,639,!!d.poleTypeOther);t(p1,148,641,d.poleTypeOther);}
  const acc=d.accessories||[];
  t(p2,175,128,d.absId); t(p2,433,128,d.linksId); t(p2,175,142,d.dropoutFuseId); t(p2,433,142,d.transformerId);
  t(p2,175,157,d.regulatorId); t(p2,433,157,d.sectionliserId); t(p2,175,171,d.faultIndicatorId);
  t(p2,433,171,d.otherEquipId); t(p2,175,186,d.lightningArresterId); t(p2,433,186,d.otherEquipType);
  ck(p2,45,126,!!d.absId); ck(p2,296,126,!!d.linksId); ck(p2,45,140,!!d.dropoutFuseId); ck(p2,296,140,!!d.transformerId);
  ck(p2,45,155,!!d.regulatorId); ck(p2,296,155,!!d.sectionliserId); ck(p2,45,169,!!d.faultIndicatorId);
  ck(p2,296,169,!!d.otherEquipId); ck(p2,45,184,!!d.lightningArresterId);
  ck(p2,45,224,acc.includes("Possum Guard")); ck(p2,215,224,acc.includes("Streetlight Fitting")); ck(p2,384,224,acc.includes("Aerial Stay"));
  ck(p2,45,239,acc.includes("Climbers")); ck(p2,215,239,acc.includes("Ground Stay")); ck(p2,384,239,acc.includes("Platform"));
  ck(p2,45,253,acc.includes("HV Cable Riser")); ck(p2,215,253,!!d.controlBoxPurpose); t(p2,357,255,d.controlBoxPurpose);
  ck(p2,45,268,acc.includes("Bird Spikes")); ck(p2,215,268,!!d.accessoriesOther); t(p2,295,269,d.accessoriesOther);
  t(p2,194,311,d.serviceConnections); t(p2,442,311,d.serviceAddresses);
  const CR_Y=[343,359,375,391,407,423,439];
  (d.conductors||[]).forEach((c,i)=>{
    if(!(c.level||c.existing||c.size||c.material||c.insulation))return;
    t(p2,58,CR_Y[i],c.level); t(p2,130,CR_Y[i],c.existing); t(p2,191,CR_Y[i],c.size); t(p2,310,CR_Y[i],c.material); t(p2,450,CR_Y[i],c.insulation);
  });
  const CA_Y=[508,524,540,556,572,588,604];
  (d.crossarms||[]).forEach((c,i)=>{
    if(!(c.level||c.existing||c.voltage))return;
    t(p2,58,CA_Y[i],c.level); t(p2,113,CA_Y[i],c.existing); t(p2,158,CA_Y[i],c.voltage); t(p2,216,CA_Y[i],c.endSize);
    t(p2,265,CA_Y[i],c.length); t(p2,320,CA_Y[i],c.arms); t(p2,375,CA_Y[i],c.insulatorType); t(p2,475,CA_Y[i],c.armMaterial); t(p2,520,CA_Y[i],c.wires);
  });
  const lines=(d.workDescription||"").split("\n");
  const LINE_Y=[532,547,561,575,590,604,618,632,646,661,676,690,705,719,733];
  lines.slice(0,15).forEach((line,i)=>t(p3,48,LINE_Y[i],line));
  return new Uint8Array(await pdfDoc.save());
}

function PoleRecordWizard({ onClose }) {
  const [step, setStep] = useState(0);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const blobUrlRef = useRef(null);
  const [d, setD] = useState({
    conductors: [{level:"",existing:"",size:"",material:"",insulation:""}],
    crossarms: [{level:"",existing:"",voltage:"",endSize:"",length:"",arms:"",insulatorType:"",armMaterial:"",wires:""}],
    accessories: [],
  });

  const isPreview = step === W_STEPS.length - 1;

  useEffect(() => {
    if (!isPreview) return;
    setPdfGenerating(true); setPdfError(null);
    generateFilledPdf(d).then(bytes => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const blob = new Blob([bytes], { type:'application/pdf' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setPdfBytes(bytes); setPdfBlobUrl(url); setPdfGenerating(false);
    }).catch(err => {
      console.error('PDF generation failed:', err);
      setPdfError("Could not generate PDF. Please try again."); setPdfGenerating(false);
    });
  }, [step]);

  const set = k => v => setD(p=>({...p,[k]:v}));
  const tog = k => v => setD(p=>({...p,[k]:p[k]===v?"":v}));
  const togAcc = v => setD(p=>{const a=p.accessories||[];return{...p,accessories:a.includes(v)?a.filter(x=>x!==v):[...a,v]};});
  const setCond = (i,field,val) => setD(p=>{const c=[...p.conductors];c[i]={...c[i],[field]:val};return{...p,conductors:c};});
  const setCA = (i,field,val) => setD(p=>{const c=[...p.crossarms];c[i]={...c[i],[field]:val};return{...p,crossarms:c};});

  const handleShare = async () => {
    if (!pdfBlobUrl) return;
    try {
      const blob = await fetch(pdfBlobUrl).then(r=>r.blob());
      const file = new File([blob],'AS-Built-Pole-Record.pdf',{type:'application/pdf'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({title:'Powerco AS-Built Pole Record',files:[file]});
      } else if(navigator.share){
        await navigator.share({title:'Powerco AS-Built Pole Record',url:window.location.href});
      } else {
        const a=document.createElement('a'); a.href=pdfBlobUrl; a.download='AS-Built-Pole-Record.pdf'; a.click();
      }
    } catch(err){if(err.name!=='AbortError')console.error('Share failed:',err);}
  };

  const formSteps = [
    <div key="0">
      <WF label="No./Street/Road" v={d.street} set={set("street")} ph="123 Example Road" />
      <WF label="City/Town" v={d.city} set={set("city")} ph="Hamilton" />
      <WF label="District" v={d.district} set={set("district")} ph="Waikato" />
      <WF label="Powerco Workorder Number" v={d.workorderNumber} set={set("workorderNumber")} />
      <WF label="Customer Works Application Number" v={d.customerWorksNumber} set={set("customerWorksNumber")} />
      <div style={{height:1,background:"#eee",margin:"14px 0"}} />
      <WF label="Contractor" v={d.contractor} set={set("contractor")} ph="Contractor name" />
      <WF label="Date Work Completed" v={d.dateCompleted} set={set("dateCompleted")} type="date" />
      <WF label="Signed" v={d.signed} set={set("signed")} />
      <WF label="Name (Print)" v={d.namePrint} set={set("namePrint")} />
    </div>,
    <div key="1">
      <WF label="Powerco New Pole ID(s)" v={d.newPoleId} set={set("newPoleId")} />
      <WF label="Powerco Old Pole ID" v={d.oldPoleId} set={set("oldPoleId")} />
      <WCB label="GPS Required" options={["Yes","No"]} value={d.gpsRequired} onChange={tog("gpsRequired")} />
      {d.gpsRequired==="Yes"&&<div style={{background:"#f5f5f5",borderRadius:10,padding:12,marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:11,marginBottom:8,color:"#555"}}>GPS CO-ORDINATES</div>
        <WF label="North" v={d.gpsNorth} set={set("gpsNorth")} ph="e.g. 5812345" />
        <WF label="East" v={d.gpsEast} set={set("gpsEast")} ph="e.g. 1832456" />
        <WF label="Altitude above sea level (ASL)" v={d.altitude} set={set("altitude")} ph="e.g. 45m" />
      </div>}
      <WF label="Manufacturers Unique Pole ID" v={d.manufacturerPoleId} set={set("manufacturerPoleId")} ph="Required for Goldpine & Dulhunty" />
      <WF label="New Pole Manufactured Date" v={d.manufacturedDate} set={set("manufacturedDate")} type="date" />
    </div>,
    <div key="2">
      <WCB label="Type of Pole Activity" options={["New","Removed","Replaced","Relocation","Label Replaced"]} value={d.poleActivity} onChange={tog("poleActivity")} />
      <WCB label="Cross-arm Activity" options={["New","Removed","Replaced"]} value={d.crossarmActivity} onChange={tog("crossarmActivity")} />
      <WCB label="Pole Loading" options={["Angle","In Line","Road Crossing","Take Off","Termination"]} value={d.poleLoading} onChange={tog("poleLoading")} />
      <WCB label="Pole Condition" options={["New","Pre-Used"]} value={d.poleCondition} onChange={tog("poleCondition")} />
      <WCB label="Ownership" options={["Powerco","Private","Other"]} value={d.ownership} onChange={tog("ownership")} />
      {d.ownership==="Other"&&<WF label="Specify Ownership" v={d.ownershipOther} set={set("ownershipOther")} />}
      <WCB label="Shared Use" options={["Fibre","Chorus","Other"]} value={d.sharedUse} onChange={tog("sharedUse")} />
      {d.sharedUse==="Other"&&<WF label="Specify Shared Use" v={d.sharedUseOther} set={set("sharedUseOther")} />}
      <WTA label="Reason for Removal" v={d.reasonForRemoval} set={set("reasonForRemoval")} rows={2} />
    </div>,
    <div key="3">
      <div style={{marginBottom:14}}>
        <label style={wLbl}>New Pole Code & Manufacturer</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginTop:4}}>
          {POLE_CODES.map(code=>{const sel=d.poleCode===code;return<button key={code} onClick={()=>tog("poleCode")(code)} style={{padding:"7px 9px",borderRadius:8,border:`2px solid ${sel?W_PURPLE:"#ddd"}`,background:sel?W_PURPLE:"#fff",color:sel?"#fff":"#333",fontFamily:"inherit",fontSize:11,cursor:"pointer",fontWeight:sel?700:400,textAlign:"left"}}>{code}</button>;})}
          {["DULHUNTY","IUP","OTHER"].map(code=>{const sel=d.poleCode===code;return<button key={code} onClick={()=>tog("poleCode")(code)} style={{padding:"7px 9px",borderRadius:8,border:`2px solid ${sel?W_PURPLE:"#ddd"}`,background:sel?W_PURPLE:"#fff",color:sel?"#fff":"#333",fontFamily:"inherit",fontSize:11,cursor:"pointer",fontWeight:sel?700:400,textAlign:"left"}}>{code}</button>;})}
        </div>
      </div>
      {d.poleCode==="DULHUNTY"&&<WF label="State Pole Code, kN & Length" v={d.dulhuntyCode} set={set("dulhuntyCode")} ph="e.g. D300 8kN 12m" />}
      {d.poleCode==="IUP"&&<WF label="State kN & Length (Steel)" v={d.iupCode} set={set("iupCode")} ph="e.g. 12kN 11m" />}
      {d.poleCode==="OTHER"&&<WF label="State Manufacturer, kN & Length" v={d.otherCode} set={set("otherCode")} ph="e.g. Other Co 10kN 12m" />}
      <WCB label="New Pole Information (Type)" options={POLE_TYPES} value={d.poleType} onChange={tog("poleType")} />
      {d.poleType==="Other"&&<WF label="Specify Type" v={d.poleTypeOther} set={set("poleTypeOther")} />}
    </div>,
    <div key="4">
      <div style={{fontSize:13,color:"#777",marginBottom:10}}>Select equipment on pole and enter IDs where applicable.</div>
      <div style={{marginBottom:14}}>
        <label style={wLbl}>Equipment on Pole</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
          {[["ABS","absId"],["Links","linksId"],["Drop out Fuse","dropoutFuseId"],["Transformer","transformerId"],["Regulator","regulatorId"],["Sectionliser/Recloser","sectionliserId"],["Fault Indicator","faultIndicatorId"],["Lightning Arrester","lightningArresterId"]].map(([l,k])=>{
            const selected=d[k]!==undefined&&d[k]!==null;
            return<button key={k} onClick={()=>{if(selected){setD(p=>{const n={...p};delete n[k];return n;})}else{setD(p=>({...p,[k]:""}));}}} style={{padding:"7px 12px",borderRadius:8,border:`2px solid ${selected?W_PURPLE:"#ddd"}`,background:selected?W_PURPLE:"#fff",color:selected?"#fff":"#333",fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:selected?700:400}}>{l}</button>;
          })}
        </div>
      </div>
      {[["ABS","absId"],["Links","linksId"],["Drop out Fuse","dropoutFuseId"],["Transformer","transformerId"],["Regulator","regulatorId"],["Sectionliser/Recloser","sectionliserId"],["Fault Indicator","faultIndicatorId"],["Lightning Arrester","lightningArresterId"]].map(([l,k])=>(d[k]!==undefined&&d[k]!==null)&&<WF key={k} label={l+" – Equipment ID"} v={d[k]} set={set(k)} ph="Leave blank if N/A" />)}
      <div style={{marginBottom:14,marginTop:14}}>
        <label style={wLbl}>Other Equipment</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
          {[1].map(()=>{const selected=d.otherEquipType!==undefined&&d.otherEquipType!==null;return<button key="other" onClick={()=>{if(selected){setD(p=>{const n={...p};delete n.otherEquipType;delete n.otherEquipId;return n;})}else{setD(p=>({...p,otherEquipType:"",otherEquipId:""}));}}} style={{padding:"7px 12px",borderRadius:8,border:`2px solid ${selected?W_PURPLE:"#ddd"}`,background:selected?W_PURPLE:"#fff",color:selected?"#fff":"#333",fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:selected?700:400}}>Other Equipment</button>;})}
        </div>
      </div>
      {(d.otherEquipType!==undefined&&d.otherEquipType!==null)&&<div><WF label="Equipment Type" v={d.otherEquipType} set={set("otherEquipType")} ph="Specify type" /><WF label="Equipment ID" v={d.otherEquipId} set={set("otherEquipId")} /></div>}
    </div>,
    <div key="5">
      <WCB label="Pole Accessories (select all that apply)" options={["Possum Guard","Streetlight Fitting","Aerial Stay","Climbers","Ground Stay","Platform","HV Cable Riser","Bird Spikes"]} value={d.accessories} onChange={togAcc} multi />
      <div style={{marginBottom:14,marginTop:14}}>
        <label style={wLbl}>Control Box & Other Options</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
          {["Control Box","Other"].map(item=>{const isCB=item==="Control Box";const selected=isCB?!!d.controlBoxPurpose:!!d.accessoriesOther;return<button key={item} onClick={()=>{if(!selected){if(isCB)setD(p=>({...p,controlBoxPurpose:""}));else setD(p=>({...p,accessoriesOther:""}));}}} style={{padding:"7px 12px",borderRadius:8,border:`2px solid ${selected?W_PURPLE:"#ddd"}`,background:selected?W_PURPLE:"#fff",color:selected?"#fff":"#333",fontFamily:"inherit",fontSize:13,cursor:"pointer",fontWeight:selected?700:400}}>{item}</button>;})}
        </div>
      </div>
      {d.controlBoxPurpose!==undefined&&d.controlBoxPurpose!==null&&<WF label="Control Box – Stipulate Purpose" v={d.controlBoxPurpose} set={set("controlBoxPurpose")} ph="Leave blank if N/A" />}
      {d.accessoriesOther!==undefined&&d.accessoriesOther!==null&&<WF label="Other Accessories (specify)" v={d.accessoriesOther} set={set("accessoriesOther")} />}
    </div>,
    <div key="6">
      <WF label="Number of Pole Service Connections" v={d.serviceConnections} set={set("serviceConnections")} ph="e.g. 2" />
      <WF label="Address(s) of Service(s) from Pole" v={d.serviceAddresses} set={set("serviceAddresses")} ph="List addresses" />
      <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#333"}}>Conductors</div>
      {(()=>{const firstEmptyIdx=d.conductors.findIndex(c=>!(c.level||c.existing||c.size||c.material||c.insulation));return d.conductors.map((c,i)=>{const hasData=c.level||c.existing||c.size||c.material||c.insulation;const isFirstEmpty=i===firstEmptyIdx;const isLastRow=i===d.conductors.length-1;return(hasData||isFirstEmpty)?<div key={i} style={{background:"#f8f8ff",border:"1.5px solid #ddd",borderRadius:10,padding:11,marginBottom:10,position:"relative"}}><button onClick={()=>setD(p=>({...p,conductors:p.conductors.filter((_,idx)=>idx!==i)}))} style={{position:"absolute",top:8,right:8,background:"none",border:"none",fontSize:18,color:"#999",cursor:"pointer",padding:0}}>×</button><div style={{fontWeight:600,fontSize:12,marginBottom:6,color:W_PURPLE}}>Row {i+1}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><WF label="Level" v={c.level} set={v=>setCond(i,"level",v)} ph="LV,11,33" /><WF label="E or N" v={c.existing} set={v=>setCond(i,"existing",v)} ph="E or N" /><WF label="Conductor Size" v={c.size} set={v=>setCond(i,"size",v)} ph="e.g. 95mm²" /><WF label="Material" v={c.material} set={v=>setCond(i,"material",v)} ph="ACSR" /></div><WF label="Insulation Type" v={c.insulation} set={v=>setCond(i,"insulation",v)} ph="Bare, Covered" />{isLastRow&&d.conductors.length<7&&<button onClick={()=>setD(p=>({...p,conductors:[...p.conductors,{level:"",existing:"",size:"",material:"",insulation:""}]}))} style={{marginTop:10,padding:"10px 16px",borderRadius:8,border:"none",background:W_PURPLE,color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Another Row</button>}</div>:null;});})()}
    </div>,
    <div key="7">
      <div style={{background:"#fffff0",border:"1px solid #e0e000",borderRadius:8,padding:9,marginBottom:12,fontSize:11,color:"#555"}}><b>End Size:</b> B=100×100, D=100×150 | <b>Length:</b> 20=2m, 23=2.3m<br/><b>Material:</b> T=Timber, S=Steel, C=Composite | <b>Insulators:</b> PN=Pin(LV), PS=Post(HV), TT=Term-Term, DP=Delta Post, EDO</div>
      <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#333"}}>Crossarms</div>
      {(()=>{const firstEmptyIdx=d.crossarms.findIndex(c=>!(c.level||c.existing||c.voltage||c.endSize||c.length||c.arms||c.insulatorType||c.armMaterial||c.wires));return d.crossarms.map((c,i)=>{const hasData=c.level||c.existing||c.voltage||c.endSize||c.length||c.arms||c.insulatorType||c.armMaterial||c.wires;const isFirstEmpty=i===firstEmptyIdx;const isLastRow=i===d.crossarms.length-1;return(hasData||isFirstEmpty)?<div key={i} style={{background:"#f8f8ff",border:"1.5px solid #ddd",borderRadius:10,padding:11,marginBottom:10,position:"relative"}}><button onClick={()=>setD(p=>({...p,crossarms:p.crossarms.filter((_,idx)=>idx!==i)}))} style={{position:"absolute",top:8,right:8,background:"none",border:"none",fontSize:18,color:"#999",cursor:"pointer",padding:0}}>×</button><div style={{fontWeight:600,fontSize:12,marginBottom:6,color:W_PURPLE}}>Crossarm {i+1}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}><WF label="Level" v={c.level} set={v=>setCA(i,"level",v)} ph="LV,11" /><WF label="E or N" v={c.existing} set={v=>setCA(i,"existing",v)} ph="E/N" /><WF label="Rated Voltage" v={c.voltage} set={v=>setCA(i,"voltage",v)} ph="LV/11" /><WF label="End Size" v={c.endSize} set={v=>setCA(i,"endSize",v)} ph="B/D" /><WF label="Length" v={c.length} set={v=>setCA(i,"length",v)} ph="20/23" /><WF label="# Arms" v={c.arms} set={v=>setCA(i,"arms",v)} ph="1/2" /><WF label="Insulator Type" v={c.insulatorType} set={v=>setCA(i,"insulatorType",v)} ph="PN/PS" /><WF label="Arm Material" v={c.armMaterial} set={v=>setCA(i,"armMaterial",v)} ph="T/S/C" /><WF label="# Wires" v={c.wires} set={v=>setCA(i,"wires",v)} ph="2-6" /></div>{isLastRow&&d.crossarms.length<7&&<button onClick={()=>setD(p=>({...p,crossarms:[...p.crossarms,{level:"",existing:"",voltage:"",endSize:"",length:"",arms:"",insulatorType:"",armMaterial:"",wires:""}]}))} style={{marginTop:10,padding:"10px 16px",borderRadius:8,border:"none",background:W_PURPLE,color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Another Row</button>}</div>:null;});})()}
    </div>,
    <div key="8">
      <div style={{fontSize:13,color:"#777",marginBottom:10}}>Illustrate asset location if the pole is new or has been moved more than 1 metre. Show any LV break positions.</div>
      <WTA label="Describe the work performed" v={d.workDescription} set={set("workDescription")} rows={12} ph="Describe all work performed..." />
    </div>,
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"#f4f4f8",fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column",overflowX:"hidden"}}>
      {/* Wizard Header */}
      <div style={{background:W_PURPLE,color:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{width:32,height:32,background:W_YELLOW,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{width:14,height:14,background:W_PURPLE,borderRadius:"50%",border:"2px solid #fff"}} />
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:16,letterSpacing:1}}>POWERCO</div>
          <div style={{fontSize:10,opacity:.8}}>AS-BUILT POLE RECORD – Form Wizard</div>
        </div>
        <button onClick={onClose} title="Close wizard" style={{padding:6,border:"none",background:"rgba(255,255,255,0.15)",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <X size={20} color="#fff" />
        </button>
      </div>

      {/* Progress bar */}
      <div style={{background:"#fff",borderBottom:"1px solid #eee",padding:"10px 16px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:13,fontWeight:700,color:W_PURPLE}}>{W_STEPS[step]}</span>
          <span style={{fontSize:12,color:"#999"}}>{step+1} / {W_STEPS.length}</span>
        </div>
        <div style={{height:4,background:"#eee",borderRadius:4,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${(step+1)/W_STEPS.length*100}%`,background:W_YELLOW,borderRadius:4,transition:"width .3s"}} />
        </div>
        <div style={{display:"flex",gap:3,marginTop:6}}>
          {W_STEPS.map((_,i)=><button key={i} onClick={()=>setStep(i)} style={{flexShrink:0,width:i===step?18:7,height:7,borderRadius:4,border:"none",padding:0,cursor:"pointer",background:i<step?W_PURPLE:i===step?W_YELLOW:"#ddd",transition:"all .2s"}} />)}
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 90px"}}>
        {!isPreview && (
          <div style={{background:"#fff",borderRadius:14,padding:18,boxShadow:"0 2px 10px rgba(0,0,0,.07)"}}>
            {formSteps[step]}
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #eee",padding:"10px 16px",display:"flex",gap:10}}>
        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:13,borderRadius:12,border:`2px solid ${W_PURPLE}`,background:"#fff",color:W_PURPLE,fontFamily:"inherit",fontSize:15,fontWeight:600,cursor:"pointer"}}>← Back</button>}
        {step<W_STEPS.length-1&&<button onClick={()=>setStep(s=>s+1)} style={{flex:2,padding:13,borderRadius:12,border:"none",background:W_PURPLE,color:"#fff",fontFamily:"inherit",fontSize:15,fontWeight:700,cursor:"pointer"}}>{step===W_STEPS.length-2?"Preview Form →":"Next →"}</button>}
      </div>

      {/* Full-screen PDF preview */}
      {isPreview && (
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.9)",zIndex:10,display:"flex",flexDirection:"column"}}>
          <div style={{background:"#fff",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
              <FileText size={22} color={W_PURPLE} style={{flexShrink:0}} />
              <span style={{fontWeight:600,fontSize:15,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>AS-Built Pole Record</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:12,flexShrink:0}}>
              <button onClick={handleShare} style={{padding:"8px 14px",border:"none",background:W_PURPLE,color:"#fff",cursor:"pointer",borderRadius:8,display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",fontSize:13,fontWeight:700}}>
                <Share2 size={16} color="#fff" />Print / Save / Share
              </button>
              <button onClick={()=>setStep(s=>s-1)} title="Back to edit" style={{padding:8,border:"none",background:"none",cursor:"pointer",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <X size={24} color="#dc2626" />
              </button>
            </div>
          </div>
          <div style={{flex:1,background:"#111827",overflowY:"auto",padding:"16px"}}>
            {pdfGenerating&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",color:"#9ca3af"}}><div style={{fontSize:36,marginBottom:12}}>⚙️</div><div style={{fontSize:15,fontWeight:600}}>Generating PDF…</div></div>}
            {pdfError&&!pdfGenerating&&<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%"}}><div style={{fontSize:14,color:"#f87171",marginBottom:12}}>{pdfError}</div><button onClick={()=>setStep(W_STEPS.length-1)} style={{padding:"10px 20px",borderRadius:8,border:"none",background:W_PURPLE,color:"#fff",fontFamily:"inherit",fontSize:14,fontWeight:700,cursor:"pointer"}}>Retry</button></div>}
            {!pdfGenerating&&!pdfError&&pdfBytes&&<PdfCanvasPreview pdfBytes={pdfBytes} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Form Selector App ─────────────────────────────────────────────────────────
const AsBuiltFormSelector = () => {
  const [selectedWork, setSelectedWork] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCommissioning, setShowCommissioning] = useState(false);
  const [viewMode, setViewMode] = useState('workType');
  const [formSearchTerm, setFormSearchTerm] = useState('');
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [currentPdfName, setCurrentPdfName] = useState('');
  const [poleChoiceOpen, setPoleChoiceOpen] = useState(false);
  const [poleWizardOpen, setPoleWizardOpen] = useState(false);

  // Form definitions with local file paths
  // PDFs should be placed in the public/forms/ folder
  const formDefinitions = {
    '360S014EA': {
      name: 'As-built Low Voltage Connection Record',
      fileName: '360S014EA.pdf'
    },
    '360S014EB': {
      name: 'As-built Electrical Distribution Record',
      fileName: '360S014EB.pdf'
    },
    '360S014EC': {
      name: 'As-built Pole Record',
      fileName: '360S014EC.pdf'
    },
    '360S014ED': {
      name: 'As-built LV Box Record',
      fileName: '360S014ED.pdf'
    },
    '360S014EE': {
      name: 'As-built Electrical Equipment Record',
      fileName: '360S014EE.pdf'
    },
    '360S014EF': {
      name: 'As-built Zone Substation Equipment Record',
      fileName: '360S014EF.pdf'
    },
    '360S014EG': {
      name: 'As-built Transformer Record',
      fileName: '360S014EG.pdf'
    },
    '360S014EH': {
      name: 'As-built Equipment Record Cards',
      fileName: '360S014EH.pdf'
    },
    '360S014EI': {
      name: 'As-built Underground Network Distribution Panel Layout Record',
      fileName: '360S014EI.pdf'
    },
    '360S014EJ': {
      name: 'As-built Earth Installation and Test Record',
      fileName: '360S014EJ.pdf'
    },
    '360S014EK': {
      name: 'As-built Streetlight Alteration/Installation Record',
      fileName: '360S014EK.pdf'
    },
    '360S014EL': {
      name: 'As-built Cable Test Report',
      fileName: '360S014EL.pdf'
    },
    '360S014EM': {
      name: 'As-built Requirements Checklist - Zone Substation',
      fileName: '360S014EM.pdf'
    },
    '360S014EO': {
      name: 'As-built Transformer ICP Change Form',
      fileName: '360S014EO.pdf'
    },
    '360S014EP': {
      name: 'As-built Protection Relay Record',
      fileName: '360S014EP.pdf'
    },
    '360S014EQ': {
      name: 'Commissioning Conductor Tension Method & Results/Run Form',
      fileName: '360S014EQ.pdf'
    },
    '360S014ER': {
      name: 'As-built Line Fault Indicator Record LM2SAT',
      fileName: '360S014ER.pdf'
    },
    '360S014ES': {
      name: 'As-built Line Fault Indicator Record PM3SAT',
      fileName: '360S014ES.pdf'
    },
    '360S014ET': {
      name: 'As-built Line Fault Indicator Record PM6SAT',
      fileName: '360S014ET.pdf'
    },
    '360S014EU': {
      name: 'As-built Line Fault Indicator Record PM9SAT',
      fileName: '360S014EU.pdf'
    },
    '360S014EV': {
      name: 'As-built Network Communications Equipment Record',
      fileName: '360S014EV.pdf'
    },
    '360S014EW': {
      name: 'As-built Remote Terminal Unit Equipment Record',
      fileName: '360S014EW.pdf'
    },
    '360F019CA': {
      name: 'Drawing Approval Form',
      fileName: '360F019CA.pdf'
    },
    'MFG_CERT': {
      name: 'Manufacturer Test Certificates',
      fileName: null // No file - varies by manufacturer
    }
  };

  // Commissioning & Test Certificates (220F028 series)
  const commissioningCerts = {
    '220F028A': {
      name: 'Pre-Commissioning HV Inspection Certificate – Minor Works',
      fileName: '220F028A.pdf'
    },
    '220F028B': {
      name: 'Distribution Transformer Commissioning Certificate',
      fileName: '220F028B.pdf'
    },
    '220F028C': {
      name: 'LV Service Boxes, Cabinets and Subterranean Vaults Commissioning Certificate',
      fileName: '220F028C.pdf'
    },
    '220F028D': {
      name: 'LV Link Boxes and Link Cabinets Test Certificate',
      fileName: '220F028D.pdf'
    },
    '220F028E': {
      name: 'LV Customer Connection and Polarity Checks Test Certificate',
      fileName: '220F028E.pdf'
    },
    '220F028F': {
      name: 'Overhead LV Distribution Circuit Test Certificate',
      fileName: '220F028F.pdf'
    },
    '220F028G': {
      name: 'Underground LV Distribution Circuit Test Certificate',
      fileName: '220F028G.pdf'
    }
  };

  // Tailgate / Pre-Work Risk Assessment form
  const tailgateForm = {
    id: 'TAILGATE',
    name: 'Pre-Work Risk Assessment (Tailgate) Form',
    fileName: 'Tailgate.pdf'
  };

  // Northpower internal test / verification sheets
  const testSheets = {
    'TSTSHT-0051-1': {
      name: 'LV Connection Testing Verification Sheet',
      fileName: '51-1_Test_Sheet.PDF'
    },
    'DIST-TX-TEST': {
      name: 'Distribution Transformer Test Verification Sheet',
      fileName: 'Distribution_Transformer_Test_Verification_Check_Sheet.PDF'
    },
    'HV-CABLE-TEST': {
      name: 'HV Cables Test Sheet',
      fileName: 'HV_Cables_Test_Check_Sheet.PDF'
    }
  };

  // Work type to forms mapping based on the matrix
  const workTypeMapping = {
    'LV Service Connection - OH and UG': {
      forms: ['360S014EA'],
      notes: 'New or Altered Connections',
      commissioningCerts: ['220F028E']
    },
    'LV Distribution Network': {
      forms: ['360S014EB', '360S014EC', '360S014EL'],
      notes: 'For UG Distribution Network (360S014EL)',
      commissioningCerts: ['220F028F', '220F028G', '220F028C']
    },
    'HV Distribution Network': {
      forms: ['360S014EB', '360S014EC', '360S014EE', '360S014EL'],
      notes: 'For UG Distribution Network (360S014EL)',
      commissioningCerts: ['220F028A', '220F028F', '220F028G']
    },
    'Poles': {
      forms: ['360S014EC', '360S014EE'],
      notes: 'Either As-Built Pole Record Form or Network Asset Design Register can be used',
      commissioningCerts: []
    },
    'Crossarms': {
      forms: ['360S014EC'],
      commissioningCerts: []
    },
    'Equipment (installation/changes)': {
      forms: ['360S014EE', '360S014EH', '360S014EJ', 'MFG_CERT'],
      notes: 'EE: Any equipment not specified elsewhere; EH: For Critical Spares; EJ: Where an Earth Test has been taken',
      commissioningCerts: ['220F028A']
    },
    'Zone Substations': {
      forms: ['360S014EF', '360S014EE', '360S014EH', '360F019CA'],
      notes: 'For any Engineering as-built drawings (360F019CA)',
      commissioningCerts: ['220F028A']
    },
    'Transformers - Overhead': {
      forms: ['360S014EC', '360S014EG', '360S014EH', '360S014EE', '360S014EJ', 'MFG_CERT'],
      notes: 'Equip Record Card or Form (EG or EH)',
      commissioningCerts: ['220F028A', '220F028B']
    },
    'Transformers - Ground mount': {
      forms: ['360S014EG', '360S014EH', '360S014EE', '360S014EJ', 'MFG_CERT'],
      notes: 'Equip Record Card or Form (EG or EH)',
      commissioningCerts: ['220F028A', '220F028B']
    },
    'LV Service Box': {
      forms: ['360S014ED'],
      notes: 'For boxes containing service fuses only',
      commissioningCerts: ['220F028C']
    },
    'LV Distribution Box': {
      forms: ['360S014EC', '360S014ED', '360S014EJ'],
      notes: 'For vertical disconnects (Pillar) use ED; For horizontal disconnects (Link) use ED',
      commissioningCerts: ['220F028C', '220F028D']
    },
    'Earth Test / Alterations': {
      forms: ['360S014EJ'],
      commissioningCerts: []
    },
    'Streetlights': {
      forms: ['360S014EK'],
      commissioningCerts: []
    },
    'Protection Relays': {
      forms: ['360S014EP'],
      commissioningCerts: ['220F028A']
    },
    'Conductor Tension Works': {
      forms: ['360S014EQ'],
      commissioningCerts: []
    },
    'Line Fault Indicators': {
      forms: ['360S014ER', '360S014ES', '360S014ET', '360S014EU'],
      notes: 'Select appropriate form based on indicator model',
      commissioningCerts: []
    },
    'Network Communications Equipment': {
      forms: ['360S014EV'],
      commissioningCerts: []
    },
    'Remote Terminal Unit (RTU)': {
      forms: ['360S014EW'],
      commissioningCerts: []
    }
  };

  const handleFormClick = (url, name, formId) => {
    // Pole Record gets a special choice modal
    if (formId === '360S014EC') {
      setPoleChoiceOpen(true);
      return;
    }

    // Improved iOS detection (works with modern iPads)
    const isIOS = (() => {
      // Check for iOS devices
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      
      // iPhone, iPod
      if (/iPhone|iPod/.test(userAgent) && !window.MSStream) {
        return true;
      }
      
      // iPad detection (iOS 13+ reports as Mac)
      if (navigator.maxTouchPoints && 
          navigator.maxTouchPoints > 2 && 
          /MacIntel/.test(navigator.platform)) {
        return true;
      }
      
      // Older iPad detection
      if (/iPad/.test(userAgent) && !window.MSStream) {
        return true;
      }
      
      return false;
    })();
    
    if (isIOS) {
      // On iOS: Open in modal viewer
      setCurrentPdfUrl(url);
      setCurrentPdfName(name || url.split('/').pop());
      setPdfViewerOpen(true);
    } else {
      // On desktop/Android: Open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleClosePdf = () => {
    setPdfViewerOpen(false);
    setCurrentPdfUrl('');
    setCurrentPdfName('');
  };

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleShare = async () => {
    if (navigator.share && navigator.canShare) {
      try {
        // Fetch the PDF as a blob
        const response = await fetch(currentPdfUrl);
        const blob = await response.blob();
        const file = new File([blob], currentPdfName, { type: 'application/pdf' });
        
        // Check if we can share files
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: currentPdfName
          });
          // Share successful - stay in modal, don't close
        } else {
          // Can't share files, share URL instead
          await navigator.share({
            title: currentPdfName,
            url: currentPdfUrl
          });
        }
      } catch (error) {
        // User cancelled or error - do nothing, stay in modal
        console.log('Share cancelled or failed');
      }
    }
  };

  // Filter work types based on search
  const filteredWorkTypes = Object.keys(workTypeMapping).filter(work =>
    work.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get required forms and certificates for selected work type
  const requiredForms = selectedWork && workTypeMapping[selectedWork]
    ? workTypeMapping[selectedWork].forms.map(formId => ({
        id: formId,
        name: formDefinitions[formId]?.name || 'Unknown Form',
        url: formDefinitions[formId]?.fileName ? `forms/${formDefinitions[formId].fileName}` : null,
        alternateUrl: formDefinitions[formId]?.alternateFileName ? `forms/${formDefinitions[formId].alternateFileName}` : null,
        hasLink: !!formDefinitions[formId]?.fileName
      }))
    : [];

  const requiredCerts = selectedWork && workTypeMapping[selectedWork]
    ? workTypeMapping[selectedWork].commissioningCerts.map(certId => ({
        id: certId,
        name: commissioningCerts[certId]?.name || 'Unknown Certificate',
        url: commissioningCerts[certId]?.fileName ? `forms/${commissioningCerts[certId].fileName}` : null,
        hasLink: !!commissioningCerts[certId]?.fileName
      }))
    : [];

  // Get all forms for browse mode
  const allAsBuiltForms = Object.entries(formDefinitions)
    .filter(([id]) => id !== 'MFG_CERT')
    .map(([id, form]) => ({
      id,
      name: form.name,
      url: form.fileName ? `forms/${form.fileName}` : null,
      alternateUrl: form.alternateFileName ? `forms/${form.alternateFileName}` : null,
      hasLink: !!form.fileName
    }))
    .filter(form => 
      form.id.toLowerCase().includes(formSearchTerm.toLowerCase()) ||
      form.name.toLowerCase().includes(formSearchTerm.toLowerCase())
    );

  const allCommissioningForms = Object.entries(commissioningCerts)
    .map(([id, cert]) => ({
      id,
      name: cert.name,
      url: cert.fileName ? `forms/${cert.fileName}` : null,
      hasLink: !!cert.fileName
    }))
    .filter(cert => 
      cert.id.toLowerCase().includes(formSearchTerm.toLowerCase()) ||
      cert.name.toLowerCase().includes(formSearchTerm.toLowerCase())
    );

  // Filter tailgate form based on search
  const showTailgate = formSearchTerm === '' ||
    tailgateForm.id.toLowerCase().includes(formSearchTerm.toLowerCase()) ||
    tailgateForm.name.toLowerCase().includes(formSearchTerm.toLowerCase());

  // Filter test sheets based on search
  const filteredTestSheets = Object.entries(testSheets)
    .filter(([id, sheet]) =>
      formSearchTerm === '' ||
      id.toLowerCase().includes(formSearchTerm.toLowerCase()) ||
      sheet.name.toLowerCase().includes(formSearchTerm.toLowerCase())
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6 pb-16">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="text-indigo-600" size={32} />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Don's Field Forms
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Select forms by work type or browse all available forms
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setViewMode('workType')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                viewMode === 'workType'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Briefcase size={20} />
              By Work Type
            </button>
            <button
              onClick={() => setViewMode('allForms')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                viewMode === 'allForms'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List size={20} />
              Browse All Forms
            </button>
          </div>
        </div>

        {/* Work Type View */}
        {viewMode === 'workType' && (
          <>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search work types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white shadow-sm"
                />
              </div>
            </div>

            {/* Work Type Selection */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Type of Work
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredWorkTypes.map((work) => (
                  <button
                    key={work}
                    onClick={() => setSelectedWork(work)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedWork === work
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedWork === work ? (
                        <CheckCircle2 className="text-indigo-600 flex-shrink-0" size={20} />
                      ) : (
                        <Circle className="text-gray-400 flex-shrink-0" size={20} />
                      )}
                      <span className="font-medium text-gray-800">{work}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Required Forms */}
            {selectedWork && (
              <div className="bg-white rounded-xl shadow-lg p-6 animate-fadeIn">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  Required Forms ({requiredForms.length})
                </h2>
                
                {workTypeMapping[selectedWork].notes && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> {workTypeMapping[selectedWork].notes}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {requiredForms.map((form, index) => (
                    <div
                      key={form.id}
                      onClick={() => form.hasLink && handleFormClick(form.url, form.name, form.id)}
                      className={`p-4 border-2 rounded-lg ${
                        form.hasLink 
                          ? 'border-indigo-200 bg-indigo-50 cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-200 transition-all'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-indigo-900">
                              {form.id}
                            </p>
                            {form.hasLink && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
                                <Download size={12} />
                                <span>Download</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">
                            {form.name}
                          </p>
                          {form.alternateUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFormClick(form.alternateUrl, form.name);
                              }}
                              className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                            >
                              <ExternalLink size={12} />
                              Download Excel version
                            </button>
                          )}
                          {!form.hasLink && form.id === 'MFG_CERT' && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              Contact manufacturer for specific certificates
                            </p>
                          )}
                        </div>
                        {form.hasLink && (
                          <ExternalLink className="flex-shrink-0 text-indigo-600" size={20} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Reminder:</strong> Depending on the work undertaken, one or multiple as-built forms may be required. Pre-commissioning and commissioning test forms should be uploaded separately from the workpack.
                  </p>
                </div>

                {/* Commissioning & Test Certificates Section */}
                {requiredCerts.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => setShowCommissioning(!showCommissioning)}
                      className="w-full flex items-center justify-between p-4 bg-green-50 border-2 border-green-300 rounded-lg hover:bg-green-100 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="text-green-700" size={20} />
                        <span className="font-semibold text-green-900">
                          Commissioning & Test Certificates ({requiredCerts.length})
                        </span>
                      </div>
                      {showCommissioning ? (
                        <ChevronUp className="text-green-700" size={20} />
                      ) : (
                        <ChevronDown className="text-green-700" size={20} />
                      )}
                    </button>

                    {showCommissioning && (
                      <div className="mt-3 space-y-3 animate-fadeIn">
                        {requiredCerts.map((cert, index) => (
                          <div
                            key={cert.id}
                            onClick={() => cert.hasLink && handleFormClick(cert.url, cert.name)}
                            className={`p-4 border-2 rounded-lg ${
                              cert.hasLink 
                                ? 'border-green-200 bg-green-50 cursor-pointer hover:bg-green-100 hover:border-green-300 active:bg-green-200 transition-all'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-green-900">
                                    {cert.id}
                                  </p>
                                  {cert.hasLink && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                                      <Download size={12} />
                                      <span>Download</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mt-1">
                                  {cert.name}
                                </p>
                              </div>
                              {cert.hasLink && (
                                <ExternalLink className="flex-shrink-0 text-green-600" size={20} />
                              )}
                            </div>
                          </div>
                        ))}

                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-xs text-green-800">
                            <strong>Note:</strong> These commissioning and test certificates verify that installed equipment is safe and ready for service. Complete and submit these separately from as-built documentation forms.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Empty State */}
            {!selectedWork && (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">
                  Select a type of work above to see the required forms
                </p>
              </div>
            )}
          </>
        )}

        {/* Browse All Forms View */}
        {viewMode === 'allForms' && (
          <>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search forms by name or ID..."
                  value={formSearchTerm}
                  onChange={(e) => setFormSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white shadow-sm"
                />
              </div>
            </div>

            {/* Tailgate Form - FIRST */}
            {showTailgate && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="text-orange-600" size={24} />
                  Pre-Work Risk Assessment
                </h2>
                
                <div
                  onClick={() => handleFormClick(`forms/${tailgateForm.fileName}`, tailgateForm.name)}
                  className="p-4 border-2 border-orange-200 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 hover:border-orange-300 active:bg-orange-200 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-orange-900">
                          {tailgateForm.id}
                        </p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-600 text-white text-xs rounded-full">
                          <Download size={10} />
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {tailgateForm.name}
                      </p>
                    </div>
                    <ExternalLink className="flex-shrink-0 text-orange-600" size={18} />
                  </div>
                </div>
              </div>
            )}

            {/* Test Sheets - SECOND */}
            {filteredTestSheets.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="text-purple-600" size={24} />
                  Test & Verification Sheets ({filteredTestSheets.length})
                </h2>
                
                <div className="grid md:grid-cols-2 gap-3">
                  {filteredTestSheets.map(([id, sheet]) => (
                    <div
                      key={id}
                      onClick={() => handleFormClick(`forms/${sheet.fileName}`, sheet.name)}
                      className="p-4 border-2 border-purple-200 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 hover:border-purple-300 active:bg-purple-200 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-purple-900">
                              {id}
                            </p>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                              <Download size={10} />
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">
                            {sheet.name}
                          </p>
                        </div>
                        <ExternalLink className="flex-shrink-0 text-purple-600" size={18} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* As-Built Forms - THIRD */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="text-indigo-600" size={24} />
                As-Built Forms ({allAsBuiltForms.length})
              </h2>
              
              <div className="grid md:grid-cols-2 gap-3">
                {allAsBuiltForms.map((form) => (
                  <div
                    key={form.id}
                    onClick={() => form.hasLink && handleFormClick(form.url, form.name, form.id)}
                    className="p-4 border-2 border-indigo-200 bg-indigo-50 rounded-lg cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-200 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-indigo-900">
                            {form.id}
                          </p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                            <Download size={10} />
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {form.name}
                        </p>
                        {form.alternateUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFormClick(form.alternateUrl);
                            }}
                            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                          >
                            <ExternalLink size={10} />
                            Excel version
                          </button>
                        )}
                      </div>
                      <ExternalLink className="flex-shrink-0 text-indigo-600" size={18} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Commissioning Certificates - FOURTH */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="text-green-600" size={24} />
                Commissioning & Test Certificates ({allCommissioningForms.length})
              </h2>
              
              <div className="grid md:grid-cols-2 gap-3">
                {allCommissioningForms.map((cert) => (
                  <div
                    key={cert.id}
                    onClick={() => cert.hasLink && handleFormClick(cert.url)}
                    className="p-4 border-2 border-green-200 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 hover:border-green-300 active:bg-green-200 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-green-900">
                            {cert.id}
                          </p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                            <Download size={10} />
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {cert.name}
                        </p>
                      </div>
                      <ExternalLink className="flex-shrink-0 text-green-600" size={18} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewerOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
          {/* Header Bar */}
          <div className="bg-white shadow-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="text-indigo-600 flex-shrink-0" size={24} />
              <h2 className="font-semibold text-gray-900 truncate text-sm md:text-base">
                {currentPdfName}
              </h2>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 ml-4">
              {/* Share Button (iOS/Android) */}
              {navigator.share && (
                <button
                  onClick={handleShare}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Share"
                >
                  <Share2 size={20} className="text-gray-700" />
                </button>
              )}
              
              {/* Print Button */}
              <button
                onClick={handlePrint}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Print"
              >
                <Printer size={20} className="text-gray-700" />
              </button>
              
              {/* Close Button */}
              <button
                onClick={handleClosePdf}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors ml-2"
                title="Close"
              >
                <X size={24} className="text-red-600" />
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 bg-gray-900 overflow-hidden">
            <iframe
              id="pdf-iframe"
              src={currentPdfUrl}
              className="w-full h-full border-0"
              title={currentPdfName}
            />
          </div>

          {/* Bottom Action Bar (Mobile) */}
          <div className="md:hidden bg-white shadow-lg p-3 flex justify-around">
            {navigator.share && (
              <button
                onClick={handleShare}
                className="flex flex-col items-center gap-1 px-4 py-2 text-indigo-600"
              >
                <Share2 size={20} />
                <span className="text-xs">Share</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex flex-col items-center gap-1 px-4 py-2 text-indigo-600"
            >
              <Printer size={20} />
              <span className="text-xs">Print</span>
            </button>
          </div>
        </div>
      )}

      {/* Pole Record Choice Modal */}
      {poleChoiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center" onClick={()=>setPoleChoiceOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 pb-8 max-w-lg" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-indigo-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-gray-900 text-base">360S014EC – As-built Pole Record</p>
                <p className="text-sm text-gray-500">How would you like to open this form?</p>
              </div>
            </div>
            <button
              onClick={()=>{setPoleChoiceOpen(false); setPoleWizardOpen(true);}}
              className="w-full mb-3 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50 text-left hover:bg-indigo-100 active:bg-indigo-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <PenLine className="text-indigo-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-indigo-900">Fill Out Form</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Step-by-step wizard — generates a filled PDF</p>
                </div>
              </div>
            </button>
            <button
              onClick={()=>{setPoleChoiceOpen(false); handleFormClick('forms/360S014EC.pdf', 'As-built Pole Record', null);}}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 active:bg-gray-200 transition-all"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="text-gray-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">View / Download PDF</p>
                  <p className="text-xs text-gray-500 mt-0.5">Open the blank form to print or save</p>
                </div>
              </div>
            </button>
            <button onClick={()=>setPoleChoiceOpen(false)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Pole Record Wizard overlay */}
      {poleWizardOpen && <PoleRecordWizard onClose={()=>setPoleWizardOpen(false)} />}

      {/* Version Number */}
      <div style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        fontSize: '11px',
        color: '#6b7280',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '4px 8px',
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        userSelect: 'none',
        zIndex: 1000
      }}>
        v{APP_VERSION}
      </div>
    </div>
  );
};

export default AsBuiltFormSelector;