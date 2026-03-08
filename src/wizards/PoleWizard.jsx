// 360S014EC — AS-Built Pole Record
import React, { useState, useRef, useEffect } from 'react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { FileText, X, Share2, PenLine } from 'lucide-react'
import { WizardShell } from '../shared/WizardShell'
import { APP_ACCENT, APP_YELLOW } from '../shared/constants'
import { saveToHistory } from '../shared/jobHistory'
import { JobHistoryPicker } from '../shared/JobHistoryPicker'
import { wInp, wLbl, WF, WTA, WCB } from '../shared/WizardInputs'
import { SignaturePad } from '../shared/SignaturePad'
import { PdfCanvasPreview } from '../shared/PdfCanvasPreview'

const W_PURPLE = APP_ACCENT
const W_YELLOW = APP_YELLOW

const W_STEPS = ["Location & Contractor","Pole IDs & Activity","New Pole Details","Equipment on Pole","Accessories","Conductors","Crossarms","Work Description","Preview & Print"];
const POLE_CODES = ["B9.5 (Busck)","B10.0 (Busck)","B10.5 (Busck)","B11.0 (Busck)","B12.4 (Busck)","B12.5 (Busck)","B13.65 (Busck)","B14.85 (Busck)","B15.5 (Busck)","B18.5 (Busck)","9m (9kN) Goldpine","10m (9kN) Goldpine","10m (12kN) Goldpine","11m (9kN) Goldpine","11m (12kN) Goldpine","12m (12kN) Goldpine"];
const PC_X = [45,173,295,427,45,173,295,427,45,173,295,427,45,173,295,427];
const PC_Y = [478,478,478,478,493,493,493,493,507,507,507,507,521,521,521,521];
const POLE_TYPES = ["1 Pole","1 \u00BD Pole","2 Pole","3 Pole","4 Pole","H Pole","Double","Stay Pole"];
const PT_X = [45,174,296,429,45,174,296,429];
const PT_Y = [610,610,610,610,624,624,624,624];
async function generateFilledPdf(d) {
  const PAGE_H = 842;
  const BLUE = rgb(26/255, 26/255, 1);
  const existingPdfBytes = await fetch(import.meta.env.BASE_URL + 'forms/360S014EC.pdf').then(r => r.arrayBuffer());
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const [p1, p2, p3] = pages;
  const t = (page, x, cssY, str, size=8.5) => {
    if (!str) return;
    page.drawText(String(str), { x, y: PAGE_H - cssY - size, size, font, color: BLUE });
  };
  const tc = (page, centerX, cssY, str, size=8.5) => {
    if (!str) return;
    const w = font.widthOfTextAtSize(String(str), size);
    page.drawText(String(str), { x: centerX - w/2, y: PAGE_H - cssY - size, size, font, color: BLUE });
  };
  const ck = (page, x, cssY, show) => {
    if (!show) return;
    const by = PAGE_H - cssY - 2;
    page.drawLine({ start:{x, y:by-6}, end:{x:x+3, y:by-9}, thickness:1.5, color:BLUE, opacity:1 });
    page.drawLine({ start:{x:x+3, y:by-9}, end:{x:x+9, y:by-1}, thickness:1.5, color:BLUE, opacity:1 });
  };
  t(p1,115,107,d.streetRoad); t(p1,395,107,d.contractor); t(p1,395,121,d.dateWorkCompleted);
  t(p1,115,135,d.cityTown); t(p1,115,150,d.district);
  t(p1,395,150,d.namePrint);
  if (d.signed && d.signed.startsWith("data:image")) {
    const sigBytes = Uint8Array.from(atob(d.signed.split(",")[1]), c => c.charCodeAt(0));
    const sigImg = await pdfDoc.embedPng(sigBytes);
    const sigDimsPole = sigImg.scale(1);
    const sigMaxH = 20;
    const sigWPole = (sigMaxH / sigDimsPole.height) * sigDimsPole.width;
    p1.drawImage(sigImg, { x: 393, y: PAGE_H - 151, width: sigWPole, height: sigMaxH, opacity: 1 });
  } t(p1,165,164,d.pcoWONo); t(p1,451,164,d.ciwrNo);
  tc(p1,133,225,d.newPoleId); tc(p1,303,225,d.oldPoleId); t(p1,415,220,d.gpsNorth);
  t(p1,415,234,d.gpsEast); t(p1,415,265,d.altitude); tc(p1,133,273,d.manufacturerPoleId); tc(p1,303,273,d.manufacturedDate);
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


function DateBoxInput({ label, value, onChange }) {
  const ddRef = useRef(null); const mmRef = useRef(null); const yyRef = useRef(null);
  const parts = value ? value.split("-") : ["","",""];
  const dd = parts[0]||""; const mm = parts[1]||""; const yy = parts[2]||"";
  const update = (newDd, newMm, newYy) => {
    const out = [newDd,newMm,newYy].every(v=>v==="") ? "" : `${newDd}-${newMm}-${newYy}`;
    onChange(out);
  };
  const boxStyle = {
    width:52, padding:"10px 0", textAlign:"center", fontSize:18, fontWeight:600,
    border:"1.5px solid #ddd", borderRadius:8, fontFamily:"inherit",
    background:"#fff", outline:"none", boxSizing:"border-box",
  };
  const sepStyle = { fontSize:20, fontWeight:700, color:"#aaa", padding:"0 2px", lineHeight:"44px" };
  return (
    <div style={{marginBottom:12}}>
      <label style={wLbl}>{label}</label>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <input ref={ddRef} type="text" inputMode="numeric" placeholder="DD" maxLength={2} value={dd}
          onChange={e=>{
            const v=e.target.value.replace(/\D/g,"").slice(0,2);
            update(v,mm,yy);
            if(v.length===2) mmRef.current?.focus();
          }} style={boxStyle} />
        <span style={sepStyle}>-</span>
        <input ref={mmRef} type="text" inputMode="numeric" placeholder="MM" maxLength={2} value={mm}
          onChange={e=>{
            const v=e.target.value.replace(/\D/g,"").slice(0,2);
            update(dd,v,yy);
            if(v.length===2) yyRef.current?.focus();
          }}
          onKeyDown={e=>{ if(e.key==="Backspace"&&mm==="") ddRef.current?.focus(); }}
          style={boxStyle} />
        <span style={sepStyle}>-</span>
        <input ref={yyRef} type="text" inputMode="numeric" placeholder="YY" maxLength={2} value={yy}
          onChange={e=>{
            const v=e.target.value.replace(/\D/g,"").slice(0,2);
            update(dd,mm,v);
          }}
          onKeyDown={e=>{ if(e.key==="Backspace"&&yy==="") mmRef.current?.focus(); }}
          style={boxStyle} />
      </div>
    </div>
  );
}

function PoleRecordWizard({ onClose }) {
  const [step, setStep] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false);
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


  const loadJobHistory = fields => {
    setD(prev => ({ ...prev, ...fields }))
  }


  // Auto-save job details when user advances past step 0
  const prevStepRef = React.useRef(0)
  React.useEffect(() => {
    if (prevStepRef.current === 0 && step === 1) saveToHistory(d)
    prevStepRef.current = step
  }, [step])
  const tog = k => v => setD(p=>({...p,[k]:p[k]===v?"":v}));
  const togAcc = v => setD(p=>{const a=p.accessories||[];return{...p,accessories:a.includes(v)?a.filter(x=>x!==v):[...a,v]};});
  const setCond = (i,field,val) => setD(p=>{const c=[...p.conductors];c[i]={...c[i],[field]:val};return{...p,conductors:c};});
  const setCA = (i,field,val) => setD(p=>{const c=[...p.crossarms];c[i]={...c[i],[field]:val};return{...p,crossarms:c};});

  const handleShare = async () => {
    if (!pdfBlobUrl) return
    try {
      const blob = await fetch(pdfBlobUrl).then(r => r.blob())
      const file = new File([blob], 'AS-Built-Pole-Record.pdf', { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // iOS Safari — native share sheet with file
        await navigator.share({ title: 'Powerco AS-Built Pole Record', files: [file] })
      } else {
        // Android / desktop — open in new tab so browser PDF viewer
        // provides its own share/save controls
        window.open(pdfBlobUrl, '_blank')
      }
    } catch (err) { if (err.name !== 'AbortError') console.error('Share failed:', err) }
  };

  const formSteps = [
    <div key="0">
      <button onClick={() => setPickerOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '10px 14px', marginBottom: 14, width: '100%',
        background: '#eef2ff', border: `2px solid ${APP_ACCENT}`,
        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 13, fontWeight: 700, color: APP_ACCENT,
      }}>
        <span style={{ fontSize: 16 }}>📋</span> Load Previous Job
      </button>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <WF label="PCo W/O No." v={d.pcoWONo} set={set("pcoWONo")} />
        <WF label="CIWR No." v={d.ciwrNo} set={set("ciwrNo")} />
      </div>
      <WF label="No./Street/Road" v={d.streetRoad} set={set("streetRoad")} ph="123 Example Road" />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <WF label="City/Town" v={d.cityTown} set={set("cityTown")} ph="Hamilton" />
        <WF label="District" v={d.district} set={set("district")} ph="Waikato" />
      </div>
      <div style={{height:1,background:"#eee",margin:"14px 0"}} />
      <WF label="Contractor" v={d.contractor} set={set("contractor")} ph="Contractor name" />
      <WF label="Date Work Completed" v={d.dateWorkCompleted} set={set("dateWorkCompleted")} type="date" />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <WF label="Name (Print)" v={d.namePrint} set={set("namePrint")} />
      </div>
      <SignaturePad value={d.signed} onChange={set("signed")} />
    </div>,
    <div key="1">
      <WF label="Powerco Old Pole ID" v={d.oldPoleId} set={set("oldPoleId")} />
      <WCB label="Type of Pole Activity" options={["New","Removed","Replaced","Relocation","Label Replaced"]} value={d.poleActivity} onChange={tog("poleActivity")} />
      {(d.poleActivity==="New"||d.poleActivity==="Replaced"||d.poleActivity==="Label Replaced")&&<WF label="Powerco New Pole ID(s)" v={d.newPoleId} set={set("newPoleId")} />}
      {(d.poleActivity==="New"||d.poleActivity==="Replaced")&&<DateBoxInput label="New Pole Manufactured Date" value={d.manufacturedDate||""} onChange={set("manufacturedDate")} />}
      <WCB label="Cross-arm Activity" options={["New","Removed","Replaced"]} value={d.crossarmActivity} onChange={tog("crossarmActivity")} />
      <WCB label="Pole Loading" options={["Angle","In Line","Road Crossing","Take Off","Termination"]} value={d.poleLoading} onChange={tog("poleLoading")} />
      <WCB label="Ownership" options={["Powerco","Private","Other"]} value={d.ownership} onChange={tog("ownership")} />
      {d.ownership==="Other"&&<WF label="Specify Ownership" v={d.ownershipOther} set={set("ownershipOther")} />}
      <WCB label="Shared Use" options={["Fibre","Chorus","Other"]} value={d.sharedUse} onChange={tog("sharedUse")} />
      {d.sharedUse==="Other"&&<WF label="Specify Shared Use" v={d.sharedUseOther} set={set("sharedUseOther")} />}
      {(d.poleActivity==="Removed"||d.poleActivity==="Replaced")&&<WTA label="Reason for Removal" v={d.reasonForRemoval} set={set("reasonForRemoval")} rows={2} />}
    </div>,
    <div key="2">
      {!(d.poleActivity==="New"||d.poleActivity==="Replaced") ? (
        <div style={{background:"#f4f4f8",border:"1px solid #ddd",borderRadius:10,padding:"20px 18px",textAlign:"center",color:"#666",fontSize:14,lineHeight:1.6}}>
          <div style={{fontSize:28,marginBottom:8}}>🪵</div>
          <strong>New Pole Details — not applicable</strong>
          <p style={{margin:"8px 0 0",fontSize:13,color:"#888"}}>
            These fields only apply when the pole activity is <strong>New</strong> or <strong>Replaced</strong>.
            {d.poleActivity ? <> You selected <strong>{d.poleActivity}</strong>.</> : <> Select an activity on the previous step.</>}
          </p>
          <p style={{margin:"6px 0 0",fontSize:12,color:"#999"}}>Tap <strong>Next →</strong> to continue.</p>
        </div>
      ) : (
        <>
          <WCB label="GPS Required" options={["Yes","No"]} value={d.gpsRequired} onChange={tog("gpsRequired")} />
          {d.gpsRequired==="Yes"&&<div style={{background:"#f5f5f5",borderRadius:10,padding:12,marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:11,marginBottom:8,color:"#555"}}>GPS CO-ORDINATES</div>
            <WF label="North" v={d.gpsNorth} set={set("gpsNorth")} ph="e.g. 5812345" />
            <WF label="East" v={d.gpsEast} set={set("gpsEast")} ph="e.g. 1832456" />
            <WF label="Altitude above sea level (ASL)" v={d.altitude} set={set("altitude")} ph="e.g. 45m" />
          </div>}
          <WCB label="Pole Condition" options={["New","Pre-Used"]} value={d.poleCondition} onChange={tog("poleCondition")} />
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
          {d.poleCode&&!d.poleCode.includes("Busck")&&<WF label="Manufacturers Unique Pole ID" v={d.manufacturerPoleId} set={set("manufacturerPoleId")} ph="Required for Goldpine & Dulhunty" />}
          <WCB label="New Pole Information (Type)" options={POLE_TYPES} value={d.poleType} onChange={tog("poleType")} />
          {d.poleType==="Other"&&<WF label="Specify Type" v={d.poleTypeOther} set={set("poleTypeOther")} />}
        </>
      )}
    </div>,
    <div key="3">
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
    <div key="4">
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
    <div key="5">
      <WF label="Number of Pole Service Connections" v={d.serviceConnections} set={set("serviceConnections")} ph="e.g. 2" />
      {parseInt(d.serviceConnections||0,10)>=1&&<WF label="Address(s) of Service(s) from Pole" v={d.serviceAddresses} set={set("serviceAddresses")} ph="List addresses" />}
      <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#333"}}>Conductors</div>
      {(()=>{const firstEmptyIdx=d.conductors.findIndex(c=>!(c.level||c.existing||c.size||c.material||c.insulation));return d.conductors.map((c,i)=>{const hasData=c.level||c.existing||c.size||c.material||c.insulation;const isFirstEmpty=i===firstEmptyIdx;const isLastRow=i===d.conductors.length-1;return(hasData||isFirstEmpty)?<div key={i} style={{background:"#f8f8ff",border:"1.5px solid #ddd",borderRadius:10,padding:11,marginBottom:10,position:"relative"}}><button onClick={()=>setD(p=>({...p,conductors:p.conductors.filter((_,idx)=>idx!==i)}))} style={{position:"absolute",top:8,right:8,background:"none",border:"none",fontSize:18,color:"#999",cursor:"pointer",padding:0}}>×</button><div style={{fontWeight:600,fontSize:12,marginBottom:6,color:W_PURPLE}}>Row {i+1}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><WF label="Level" v={c.level} set={v=>setCond(i,"level",v)} ph="LV,11,33" /><WF label="E or N" v={c.existing} set={v=>setCond(i,"existing",v)} ph="E or N" /><WF label="Conductor Size" v={c.size} set={v=>setCond(i,"size",v)} ph="e.g. 95mm²" /><WF label="Material" v={c.material} set={v=>setCond(i,"material",v)} ph="ACSR" /></div><WF label="Insulation Type" v={c.insulation} set={v=>setCond(i,"insulation",v)} ph="Bare, Covered" />{isLastRow&&d.conductors.length<7&&<button onClick={()=>setD(p=>({...p,conductors:[...p.conductors,{level:"",existing:"",size:"",material:"",insulation:""}]}))} style={{marginTop:10,padding:"10px 16px",borderRadius:8,border:"none",background:W_PURPLE,color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Another Row</button>}</div>:null;});})()}
    </div>,
    <div key="6">
      <div style={{background:"#fffff0",border:"1px solid #e0e000",borderRadius:8,padding:9,marginBottom:12,fontSize:11,color:"#555"}}><b>End Size:</b> B=100×100, D=100×150 | <b>Length:</b> 20=2m, 23=2.3m<br/><b>Material:</b> T=Timber, S=Steel, C=Composite | <b>Insulators:</b> PN=Pin(LV), PS=Post(HV), TT=Term-Term, DP=Delta Post, EDO</div>
      <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#333"}}>Crossarms</div>
      {(()=>{const firstEmptyIdx=d.crossarms.findIndex(c=>!(c.level||c.existing||c.voltage||c.endSize||c.length||c.arms||c.insulatorType||c.armMaterial||c.wires));return d.crossarms.map((c,i)=>{const hasData=c.level||c.existing||c.voltage||c.endSize||c.length||c.arms||c.insulatorType||c.armMaterial||c.wires;const isFirstEmpty=i===firstEmptyIdx;const isLastRow=i===d.crossarms.length-1;return(hasData||isFirstEmpty)?<div key={i} style={{background:"#f8f8ff",border:"1.5px solid #ddd",borderRadius:10,padding:11,marginBottom:10,position:"relative"}}><button onClick={()=>setD(p=>({...p,crossarms:p.crossarms.filter((_,idx)=>idx!==i)}))} style={{position:"absolute",top:8,right:8,background:"none",border:"none",fontSize:18,color:"#999",cursor:"pointer",padding:0}}>×</button><div style={{fontWeight:600,fontSize:12,marginBottom:6,color:W_PURPLE}}>Crossarm {i+1}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}><WF label="Level" v={c.level} set={v=>setCA(i,"level",v)} ph="LV,11" /><WF label="E or N" v={c.existing} set={v=>setCA(i,"existing",v)} ph="E/N" /><WF label="Rated Voltage" v={c.voltage} set={v=>setCA(i,"voltage",v)} ph="LV/11" /><WF label="End Size" v={c.endSize} set={v=>setCA(i,"endSize",v)} ph="B/D" /><WF label="Length" v={c.length} set={v=>setCA(i,"length",v)} ph="20/23" /><WF label="# Arms" v={c.arms} set={v=>setCA(i,"arms",v)} ph="1/2" /><WF label="Insulator Type" v={c.insulatorType} set={v=>setCA(i,"insulatorType",v)} ph="PN/PS" /><WF label="Arm Material" v={c.armMaterial} set={v=>setCA(i,"armMaterial",v)} ph="T/S/C" /><WF label="# Wires" v={c.wires} set={v=>setCA(i,"wires",v)} ph="2-6" /></div>{isLastRow&&d.crossarms.length<7&&<button onClick={()=>setD(p=>({...p,crossarms:[...p.crossarms,{level:"",existing:"",voltage:"",endSize:"",length:"",arms:"",insulatorType:"",armMaterial:"",wires:""}]}))} style={{marginTop:10,padding:"10px 16px",borderRadius:8,border:"none",background:W_PURPLE,color:"#fff",fontFamily:"inherit",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Another Row</button>}</div>:null;});})()}
    </div>,
    <div key="7">
      <div style={{fontSize:13,color:"#777",marginBottom:10}}>Illustrate asset location if the pole is new or has been moved more than 1 metre. Show any LV break positions.</div>
      <WTA label="Describe the work performed" v={d.workDescription} set={set("workDescription")} rows={12} ph="Describe all work performed..." />
    </div>,
  ];

  // ── Computed values for shell ──────────────────────────────────────────
  const missingFields = [
    !d.pcoWONo    && 'PCo W/O No.',
    !d.streetRoad && 'Street/Road',
    !d.contractor && 'Contractor',
    !d.namePrint  && 'Name (Print)',
  ].filter(Boolean)

  const previewContent = (
    <>
      {pdfGenerating && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Generating PDF…</div>
        </div>
      )}
      {pdfError && !pdfGenerating && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <div style={{ fontSize: 14, color: '#f87171', marginBottom: 12 }}>{pdfError}</div>
          <button onClick={() => setStep(W_STEPS.length - 1)} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: W_PURPLE, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
        </div>
      )}
      {!pdfGenerating && !pdfError && pdfBytes && <PdfCanvasPreview pdfBytes={pdfBytes} />}
    </>
  )

  return (
    <>
      <WizardShell
        title="AS-Built Pole Record"
        formNumber="360S014EC"
        headerIcon={<PenLine size={22} color="#fff" style={{ flexShrink: 0 }} />}
        steps={W_STEPS}
        step={step}
        onStepClick={setStep}
        onClose={onClose}
        onBack={() => setStep(s => s - 1)}
        onNext={() => setStep(s => s + 1)}
        accent={W_PURPLE}
        bg="#f4f4f8"
        mid="#fff"
        border="#eee"
        isPreview={isPreview}
        onShare={handleShare}
        onClosePreview={() => setStep(s => s - 1)}
        missingFields={missingFields}
        previewContent={previewContent}
      >
        {formSteps[step]}
      </WizardShell>
      <JobHistoryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={loadJobHistory}
        accent={APP_ACCENT}
      />
    </>
  );
}


export default PoleRecordWizard
