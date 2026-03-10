import React, { useState, useEffect } from 'react'
import { Search, FileText, CheckCircle2, Circle, ExternalLink, Download,
  ChevronDown, ChevronUp, List, Briefcase, X, Share2, PenLine } from 'lucide-react'

import PoleRecordWizard from './wizards/PoleWizard'
import TransformerWizardApp from './wizards/TransformerWizard'
import ElecEquipWizard from './wizards/ElecEquipWizard'
import LvConnectionWizard from './wizards/LvConnectionWizard'
import ElecDistributionWizard from './wizards/ElecDistributionWizard'
import LvBoxWizard from './wizards/LvBoxWizard'
import { AuthGate } from './auth/AuthGate'
import { CHANGELOGS } from './changelog'
import { PdfCanvasPreview } from './shared/PdfCanvasPreview'

const APP_VERSION = '2.8.0'

const AsBuiltFormSelector = () => {
  const [selectedWork, setSelectedWork] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCommissioning, setShowCommissioning] = useState(false);
  const [viewMode, setViewMode] = useState('workType');
  const [formSearchTerm, setFormSearchTerm] = useState('');
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState('');
  const [currentPdfName, setCurrentPdfName] = useState('');
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [poleChoiceOpen, setPoleChoiceOpen] = useState(false);
  const [poleWizardOpen, setPoleWizardOpen] = useState(false);
  const [txChoiceOpen, setTxChoiceOpen] = useState(false);
  const [txWizardOpen, setTxWizardOpen] = useState(false);
  const [eeChoiceOpen, setEeChoiceOpen] = useState(false);
  const [eeWizardOpen, setEeWizardOpen] = useState(false);
  const [lvChoiceOpen, setLvChoiceOpen] = useState(false);
  const [lvWizardOpen, setLvWizardOpen] = useState(false);
  const [ebChoiceOpen, setEbChoiceOpen] = useState(false);
  const [ebWizardOpen, setEbWizardOpen] = useState(false);
  const [edChoiceOpen, setEdChoiceOpen] = useState(false);
  const [edWizardOpen, setEdWizardOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [changelogQueue, setChangelogQueue] = useState([])
  const [changelogIdx, setChangelogIdx]     = useState(0)

  // Pick up the install prompt captured in main.jsx before React mounted.
  useEffect(() => {
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt)
    }
    const onReady = () => setInstallPrompt(window.__pwaInstallPrompt)
    const onInstalled = () => setInstallPrompt(null)
    window.addEventListener('pwaPromptReady', onReady)
    window.addEventListener('pwaInstalled', onInstalled)
    return () => {
      window.removeEventListener('pwaPromptReady', onReady)
      window.removeEventListener('pwaInstalled', onInstalled)
    }
  }, [])

  // Show changelog for any unseen version batches.
  // Migrates from old plain-string format ('1') to new JSON array format.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('re-former-changelog-seen')
      let seen = []
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          seen = Array.isArray(parsed) ? parsed : [String(parsed)]
        } catch {
          seen = [raw]
        }
      }
      const unseen = CHANGELOGS.filter(b => !seen.includes(b.version))
      if (unseen.length > 0) {
        setChangelogQueue(unseen)
        setChangelogIdx(0)
      }
    } catch {
      setChangelogQueue([])
    }
  }, [])

  const dismissChangelog = () => {
    const current = changelogQueue[changelogIdx]
    if (!current) return
    try {
      const raw = localStorage.getItem('re-former-changelog-seen')
      let seen = []
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          seen = Array.isArray(parsed) ? parsed : [String(parsed)]
        } catch {
          seen = [raw]
        }
      }
      if (!seen.includes(current.version)) {
        localStorage.setItem('re-former-changelog-seen', JSON.stringify([...seen, current.version]))
      }
    } catch {}
    if (changelogIdx + 1 < changelogQueue.length) {
      setChangelogIdx(i => i + 1)
    } else {
      setChangelogQueue([])
      setChangelogIdx(0)
    }
  }

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
    else setInstallDismissed(true)
  }

  const formDefinitions = {
    '360S014EA': { name: 'As-built Low Voltage Connection Record', fileName: '360S014EA.pdf' },
    '360S014EB': { name: 'As-built Electrical Distribution Record', fileName: '360S014EB.pdf' },
    '360S014EC': { name: 'As-built Pole Record', fileName: '360S014EC.pdf' },
    '360S014ED': { name: 'As-built LV Box Record', fileName: '360S014ED.pdf' },
    '360S014EE': { name: 'As-built Electrical Equipment Record', fileName: '360S014EE.pdf' },
    '360S014EF': { name: 'As-built Zone Substation Equipment Record', fileName: '360S014EF.pdf' },
    '360S014EG': { name: 'As-built Transformer Record', fileName: '360S014EG.pdf' },
    '360S014EH': { name: 'As-built Equipment Record Cards', fileName: '360S014EH.pdf' },
    '360S014EI': { name: 'As-built Underground Network Distribution Panel Layout Record', fileName: '360S014EI.pdf' },
    '360S014EJ': { name: 'As-built Earth Installation and Test Record', fileName: '360S014EJ.pdf' },
    '360S014EK': { name: 'As-built Streetlight Alteration/Installation Record', fileName: '360S014EK.pdf' },
    '360S014EL': { name: 'As-built Cable Test Report', fileName: '360S014EL.pdf' },
    '360S014EM': { name: 'As-built Requirements Checklist - Zone Substation', fileName: '360S014EM.pdf' },
    '360S014EO': { name: 'As-built Transformer ICP Change Form', fileName: '360S014EO.pdf' },
    '360S014EP': { name: 'As-built Protection Relay Record', fileName: '360S014EP.pdf' },
    '360S014EQ': { name: 'Commissioning Conductor Tension Method & Results/Run Form', fileName: '360S014EQ.pdf' },
    '360S014ER': { name: 'As-built Line Fault Indicator Record LM2SAT', fileName: '360S014ER.pdf' },
    '360S014ES': { name: 'As-built Line Fault Indicator Record PM3SAT', fileName: '360S014ES.pdf' },
    '360S014ET': { name: 'As-built Line Fault Indicator Record PM6SAT', fileName: '360S014ET.pdf' },
    '360S014EU': { name: 'As-built Line Fault Indicator Record PM9SAT', fileName: '360S014EU.pdf' },
    '360S014EV': { name: 'As-built Network Communications Equipment Record', fileName: '360S014EV.pdf' },
    '360S014EW': { name: 'As-built Remote Terminal Unit Equipment Record', fileName: '360S014EW.pdf' },
    '360F019CA': { name: 'Drawing Approval Form', fileName: '360F019CA.pdf' },
    'MFG_CERT':  { name: 'Manufacturer Test Certificates', fileName: null }
  };

  const commissioningCerts = {
    '220F028A': { name: 'Pre-Commissioning HV Inspection Certificate – Minor Works', fileName: '220F028A.pdf' },
    '220F028B': { name: 'Distribution Transformer Commissioning Certificate', fileName: '220F028B.pdf' },
    '220F028C': { name: 'LV Service Boxes, Cabinets and Subterranean Vaults Commissioning Certificate', fileName: '220F028C.pdf' },
    '220F028D': { name: 'LV Link Boxes and Link Cabinets Test Certificate', fileName: '220F028D.pdf' },
    '220F028E': { name: 'LV Customer Connection and Polarity Checks Test Certificate', fileName: '220F028E.pdf' },
    '220F028F': { name: 'Overhead LV Distribution Circuit Test Certificate', fileName: '220F028F.pdf' },
    '220F028G': { name: 'Underground LV Distribution Circuit Test Certificate', fileName: '220F028G.pdf' }
  };

  const tailgateForm = {
    id: 'TAILGATE',
    name: 'Pre-Work Risk Assessment (Tailgate) Form',
    fileName: 'Tailgate.pdf'
  };

  const testSheets = {
    'TSTSHT-0051-1': { name: 'LV Connection Testing Verification Sheet', fileName: '51-1_Test_Sheet.PDF' },
    'DIST-TX-TEST':  { name: 'Distribution Transformer Test Verification Sheet', fileName: 'Distribution_Transformer_Test_Verification_Check_Sheet.PDF' },
    'HV-CABLE-TEST': { name: 'HV Cables Test Sheet', fileName: 'HV_Cables_Test_Check_Sheet.PDF' }
  };

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
    'Crossarms': { forms: ['360S014EC'], commissioningCerts: [] },
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
    'Earth Test / Alterations': { forms: ['360S014EJ'], commissioningCerts: [] },
    'Streetlights': { forms: ['360S014EK'], commissioningCerts: [] },
    'Protection Relays': { forms: ['360S014EP'], commissioningCerts: ['220F028A'] },
    'Conductor Tension Works': { forms: ['360S014EQ'], commissioningCerts: [] },
    'Line Fault Indicators': {
      forms: ['360S014ER', '360S014ES', '360S014ET', '360S014EU'],
      notes: 'Select appropriate form based on indicator model',
      commissioningCerts: []
    },
    'Network Communications Equipment': { forms: ['360S014EV'], commissioningCerts: [] },
    'Remote Terminal Unit (RTU)': { forms: ['360S014EW'], commissioningCerts: [] }
  };

  const handleFormClick = (url, name, formId) => {
    if (formId === '360S014EC') { setPoleChoiceOpen(true); return; }
    if (formId === '360S014EG') { setTxChoiceOpen(true);   return; }
    if (formId === '360S014EE') { setEeChoiceOpen(true);   return; }
    if (formId === '360S014EA') { setLvChoiceOpen(true);   return; }
    if (formId === '360S014EB') { setEbChoiceOpen(true);   return; }
    if (formId === '360S014ED') { setEdChoiceOpen(true);   return; }

    // All platforms: fetch as arrayBuffer, render via PdfCanvasPreview, share as File
    const displayName = name || url.split('/').pop();
    setCurrentPdfUrl(url);
    setCurrentPdfName(displayName);
    setPdfBytes(null);
    setPdfBlobUrl(null);
    setPdfViewerOpen(true);
    fetch(url)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const bytes = new Uint8Array(buf);
        setPdfBytes(bytes);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        setPdfBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        setPdfViewerOpen(false);
        window.open(url, '_blank', 'noopener,noreferrer');
      });
  };

  const handleClosePdf = () => {
    setPdfViewerOpen(false);
    setCurrentPdfUrl('');
    setCurrentPdfName('');
    setPdfBytes(null);
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
  };

  const handleShare = async () => {
    if (!pdfBytes) return;
    const file = new File([pdfBytes], currentPdfName, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch (_) {}
    } else if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    }
  };

  const filteredWorkTypes = Object.keys(workTypeMapping).filter(work =>
    work.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const showTailgate = formSearchTerm === '' ||
    tailgateForm.id.toLowerCase().includes(formSearchTerm.toLowerCase()) ||
    tailgateForm.name.toLowerCase().includes(formSearchTerm.toLowerCase());

  const filteredTestSheets = Object.entries(testSheets).filter(([id, sheet]) =>
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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Don's Field Forms</h1>
              <p className="text-sm text-gray-600 mt-1">Select forms by work type or browse all available forms</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setViewMode('workType')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                viewMode === 'workType' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Briefcase size={20} />By Work Type
            </button>
            <button
              onClick={() => setViewMode('allForms')}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                viewMode === 'allForms' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <List size={20} />Browse All Forms
            </button>
          </div>
        </div>

        {/* Work Type View */}
        {viewMode === 'workType' && (
          <>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                <input type="text" placeholder="Search work types..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Type of Work</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredWorkTypes.map((work) => (
                  <button key={work} onClick={() => setSelectedWork(work)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedWork === work ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedWork === work
                        ? <CheckCircle2 className="text-indigo-600 flex-shrink-0" size={20} />
                        : <Circle className="text-gray-400 flex-shrink-0" size={20} />}
                      <span className="font-medium text-gray-800">{work}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedWork && (
              <div className="bg-white rounded-xl shadow-lg p-6 animate-fadeIn">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Required Forms ({requiredForms.length})</h2>
                {workTypeMapping[selectedWork].notes && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded">
                    <p className="text-sm text-amber-800"><strong>Note:</strong> {workTypeMapping[selectedWork].notes}</p>
                  </div>
                )}
                <div className="space-y-3">
                  {requiredForms.map((form, index) => (
                    <div key={form.id}
                      onClick={() => form.hasLink && handleFormClick(form.url, form.name, form.id)}
                      className={`p-4 border-2 rounded-lg ${
                        form.hasLink
                          ? 'border-indigo-200 bg-indigo-50 cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-200 transition-all'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{index + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-indigo-900">{form.id}</p>
                            {form.hasLink && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded-full">
                                <Download size={12} /><span>Download</span>
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{form.name}</p>
                          {form.alternateUrl && (
                            <button onClick={(e) => { e.stopPropagation(); handleFormClick(form.alternateUrl, form.name); }}
                              className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1">
                              <ExternalLink size={12} />Download Excel version
                            </button>
                          )}
                          {!form.hasLink && form.id === 'MFG_CERT' && (
                            <p className="text-xs text-gray-500 mt-1 italic">Contact manufacturer for specific certificates</p>
                          )}
                        </div>
                        {form.hasLink && <ExternalLink className="flex-shrink-0 text-indigo-600" size={20} />}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Reminder:</strong> Depending on the work undertaken, one or multiple as-built forms may be required. Pre-commissioning and commissioning test forms should be uploaded separately from the workpack.
                  </p>
                </div>
                {requiredCerts.length > 0 && (
                  <div className="mt-6">
                    <button onClick={() => setShowCommissioning(!showCommissioning)}
                      className="w-full flex items-center justify-between p-4 bg-green-50 border-2 border-green-300 rounded-lg hover:bg-green-100 transition-all">
                      <div className="flex items-center gap-2">
                        <FileText className="text-green-700" size={20} />
                        <span className="font-semibold text-green-900">Commissioning & Test Certificates ({requiredCerts.length})</span>
                      </div>
                      {showCommissioning ? <ChevronUp className="text-green-700" size={20} /> : <ChevronDown className="text-green-700" size={20} />}
                    </button>
                    {showCommissioning && (
                      <div className="mt-3 space-y-3 animate-fadeIn">
                        {requiredCerts.map((cert, index) => (
                          <div key={cert.id}
                            onClick={() => cert.hasLink && handleFormClick(cert.url, cert.name)}
                            className={`p-4 border-2 rounded-lg ${
                              cert.hasLink
                                ? 'border-green-200 bg-green-50 cursor-pointer hover:bg-green-100 hover:border-green-300 active:bg-green-200 transition-all'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{index + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-semibold text-green-900">{cert.id}</p>
                                  {cert.hasLink && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                                      <Download size={12} /><span>Download</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-700 mt-1">{cert.name}</p>
                              </div>
                              {cert.hasLink && <ExternalLink className="flex-shrink-0 text-green-600" size={20} />}
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

            {!selectedWork && (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600">Select a type of work above to see the required forms</p>
              </div>
            )}
          </>
        )}

        {/* Browse All Forms View */}
        {viewMode === 'allForms' && (
          <>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                <input type="text" placeholder="Search forms by name or ID..." value={formSearchTerm}
                  onChange={(e) => setFormSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
              </div>
            </div>

            {showTailgate && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="text-orange-600" size={24} />Pre-Work Risk Assessment
                </h2>
                <div onClick={() => handleFormClick(`forms/${tailgateForm.fileName}`, tailgateForm.name)}
                  className="p-4 border-2 border-orange-200 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 hover:border-orange-300 active:bg-orange-200 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-orange-900">{tailgateForm.id}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-600 text-white text-xs rounded-full"><Download size={10} /></span>
                      </div>
                      <p className="text-sm text-gray-700">{tailgateForm.name}</p>
                    </div>
                    <ExternalLink className="flex-shrink-0 text-orange-600" size={18} />
                  </div>
                </div>
              </div>
            )}

            {filteredTestSheets.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="text-purple-600" size={24} />Test & Verification Sheets ({filteredTestSheets.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {filteredTestSheets.map(([id, sheet]) => (
                    <div key={id} onClick={() => handleFormClick(`forms/${sheet.fileName}`, sheet.name)}
                      className="p-4 border-2 border-purple-200 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 hover:border-purple-300 active:bg-purple-200 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-purple-900">{id}</p>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full"><Download size={10} /></span>
                          </div>
                          <p className="text-sm text-gray-700">{sheet.name}</p>
                        </div>
                        <ExternalLink className="flex-shrink-0 text-purple-600" size={18} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="text-indigo-600" size={24} />As-Built Forms ({allAsBuiltForms.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {allAsBuiltForms.map((form) => (
                  <div key={form.id} onClick={() => form.hasLink && handleFormClick(form.url, form.name, form.id)}
                    className="p-4 border-2 border-indigo-200 bg-indigo-50 rounded-lg cursor-pointer hover:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-200 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-indigo-900">{form.id}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full"><Download size={10} /></span>
                        </div>
                        <p className="text-sm text-gray-700">{form.name}</p>
                        {form.alternateUrl && (
                          <button onClick={(e) => { e.stopPropagation(); handleFormClick(form.alternateUrl); }}
                            className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1">
                            <ExternalLink size={10} />Excel version
                          </button>
                        )}
                      </div>
                      <ExternalLink className="flex-shrink-0 text-indigo-600" size={18} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="text-green-600" size={24} />Commissioning & Test Certificates ({allCommissioningForms.length})
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {allCommissioningForms.map((cert) => (
                  <div key={cert.id} onClick={() => cert.hasLink && handleFormClick(cert.url, cert.name)}
                    className="p-4 border-2 border-green-200 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 hover:border-green-300 active:bg-green-200 transition-all">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-green-900">{cert.id}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full"><Download size={10} /></span>
                        </div>
                        <p className="text-sm text-gray-700">{cert.name}</p>
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

      {/* PDF Viewer Modal — identical style to WizardShell PDF overlay */}
      {pdfViewerOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.9)', zIndex: 50,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header — matches WizardShell preview header exactly */}
          <div style={{
            background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <FileText size={22} color="#4f46e5" style={{ flexShrink: 0 }} />
              <span style={{
                fontWeight: 600, fontSize: 15, color: '#111',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{currentPdfName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, flexShrink: 0 }}>
              <button
                onClick={handleShare}
                disabled={!pdfBytes}
                style={{
                  padding: '8px 14px', border: 'none',
                  background: pdfBytes ? '#4f46e5' : '#9ca3af',
                  color: '#fff', cursor: pdfBytes ? 'pointer' : 'default',
                  borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                }}
              >
                <Share2 size={16} color="#fff" />
                {pdfBytes ? 'Print / Save / Share' : 'Loading…'}
              </button>
              <button onClick={handleClosePdf} style={{
                padding: 8, border: 'none', background: 'none',
                cursor: 'pointer', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={24} color="#dc2626" />
              </button>
            </div>
          </div>

          {/* PDF content — canvas render via pdf.js, same as wizard */}
          <div style={{ flex: 1, background: '#111827', overflowY: 'auto', padding: 16 }}>
            {pdfBytes ? (
              <PdfCanvasPreview pdfBytes={pdfBytes} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center', color: '#fff' }}>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-3" />
                  <p style={{ fontSize: 14, opacity: 0.75 }}>Loading PDF…</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pole Record Choice Modal */}
      {poleChoiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center" onClick={() => setPoleChoiceOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 pb-8 max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-indigo-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-gray-900 text-base">360S014EC – As-built Pole Record</p>
                <p className="text-sm text-gray-500">How would you like to open this form?</p>
              </div>
            </div>
            <button onClick={() => { setPoleChoiceOpen(false); setPoleWizardOpen(true); }}
              className="w-full mb-3 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50 text-left hover:bg-indigo-100 active:bg-indigo-200 transition-all">
              <div className="flex items-center gap-3">
                <PenLine className="text-indigo-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-indigo-900">Fill Out Form</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Step-by-step wizard — generates a filled PDF</p>
                </div>
              </div>
            </button>
            <button onClick={() => { setPoleChoiceOpen(false); handleFormClick('forms/360S014EC.pdf', 'As-built Pole Record', null); }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 active:bg-gray-200 transition-all">
              <div className="flex items-center gap-3">
                <ExternalLink className="text-gray-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">View / Download PDF</p>
                  <p className="text-xs text-gray-500 mt-0.5">Open the blank form to print or save</p>
                </div>
              </div>
            </button>
            <button onClick={() => setPoleChoiceOpen(false)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {poleWizardOpen && <PoleRecordWizard onClose={() => setPoleWizardOpen(false)} />}

      {/* Transformer Record Choice Modal */}
      {txChoiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center" onClick={() => setTxChoiceOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 pb-8 max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-indigo-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-gray-900 text-base">360S014EG – AS-Built Transformer Record</p>
                <p className="text-sm text-gray-500">How would you like to open this form?</p>
              </div>
            </div>
            <button onClick={() => { setTxChoiceOpen(false); setTxWizardOpen(true); }}
              className="w-full mb-3 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50 text-left hover:bg-indigo-100 active:bg-indigo-200 transition-all">
              <div className="flex items-center gap-3">
                <PenLine className="text-indigo-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-indigo-900">Fill Out Form</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Step-by-step wizard — generates a filled PDF</p>
                </div>
              </div>
            </button>
            <button onClick={() => { setTxChoiceOpen(false); handleFormClick('forms/360S014EG.pdf', 'AS-Built Transformer Record', null); }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 active:bg-gray-200 transition-all">
              <div className="flex items-center gap-3">
                <ExternalLink className="text-gray-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">View / Download PDF</p>
                  <p className="text-xs text-gray-500 mt-0.5">Open the blank form to print or save</p>
                </div>
              </div>
            </button>
            <button onClick={() => setTxChoiceOpen(false)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {txWizardOpen && <TransformerWizardApp onClose={() => setTxWizardOpen(false)} />}

      {/* Electrical Equipment Record Choice Modal */}
      {eeChoiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center" onClick={() => setEeChoiceOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 pb-8 max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-indigo-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-gray-900 text-base">360S014EE – As-built Electrical Equipment Record</p>
                <p className="text-sm text-gray-500">How would you like to open this form?</p>
              </div>
            </div>
            <button onClick={() => { setEeChoiceOpen(false); setEeWizardOpen(true); }}
              className="w-full mb-3 p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50 text-left hover:bg-indigo-100 active:bg-indigo-200 transition-all">
              <div className="flex items-center gap-3">
                <PenLine className="text-indigo-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-indigo-900">Fill Out Form</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Step-by-step wizard — generates a filled PDF</p>
                </div>
              </div>
            </button>
            <button onClick={() => { setEeChoiceOpen(false); handleFormClick('forms/360S014EE.pdf', 'As-built Electrical Equipment Record', null); }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 active:bg-gray-200 transition-all">
              <div className="flex items-center gap-3">
                <ExternalLink className="text-gray-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">View / Download PDF</p>
                  <p className="text-xs text-gray-500 mt-0.5">Open the blank form to print or save</p>
                </div>
              </div>
            </button>
            <button onClick={() => setEeChoiceOpen(false)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {eeWizardOpen && <ElecEquipWizard onClose={() => setEeWizardOpen(false)} />}

      {/* LV Connection Record Choice Modal */}
      {lvChoiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center" onClick={() => setLvChoiceOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 pb-8 max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-teal-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-gray-900 text-base">360S014EA – As-built LV Connection Record</p>
                <p className="text-sm text-gray-500">How would you like to open this form?</p>
              </div>
            </div>
            <button onClick={() => { setLvChoiceOpen(false); setLvWizardOpen(true); }}
              className="w-full mb-3 p-4 rounded-xl border-2 text-left transition-all"
              style={{ borderColor: '#0d9488', background: '#f0fdfa' }}>
              <div className="flex items-center gap-3">
                <PenLine style={{ color: '#0d9488', flexShrink: 0 }} size={22} />
                <div>
                  <p className="font-semibold" style={{ color: '#134e4a' }}>Fill Out Form</p>
                  <p className="text-xs mt-0.5" style={{ color: '#0d9488' }}>Step-by-step wizard — generates a filled PDF</p>
                </div>
              </div>
            </button>
            <button onClick={() => { setLvChoiceOpen(false); handleFormClick('forms/360S014EA.pdf', 'As-built LV Connection Record', null); }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 active:bg-gray-200 transition-all">
              <div className="flex items-center gap-3">
                <ExternalLink className="text-gray-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">View / Download PDF</p>
                  <p className="text-xs text-gray-500 mt-0.5">Open the blank form to print or save</p>
                </div>
              </div>
            </button>
            <button onClick={() => setLvChoiceOpen(false)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {lvWizardOpen && <LvConnectionWizard onClose={() => setLvWizardOpen(false)} />}

      {/* Electrical Distribution Record Choice Modal */}
      {ebChoiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center" onClick={() => setEbChoiceOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 pb-8 max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-orange-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-gray-900 text-base">360S014EB – As-built Electrical Distribution Record</p>
                <p className="text-sm text-gray-500">How would you like to open this form?</p>
              </div>
            </div>
            <button onClick={() => { setEbChoiceOpen(false); setEbWizardOpen(true); }}
              className="w-full mb-3 p-4 rounded-xl border-2 text-left transition-all"
              style={{ borderColor: '#ea580c', background: '#fff7ed' }}>
              <div className="flex items-center gap-3">
                <PenLine style={{ color: '#ea580c', flexShrink: 0 }} size={22} />
                <div>
                  <p className="font-semibold" style={{ color: '#7c2d12' }}>Fill Out Form</p>
                  <p className="text-xs mt-0.5" style={{ color: '#ea580c' }}>Step-by-step wizard — generates a filled PDF</p>
                </div>
              </div>
            </button>
            <button onClick={() => { setEbChoiceOpen(false); handleFormClick('forms/360S014EB.pdf', 'As-built Electrical Distribution Record', null); }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 active:bg-gray-200 transition-all">
              <div className="flex items-center gap-3">
                <ExternalLink className="text-gray-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">View / Download PDF</p>
                  <p className="text-xs text-gray-500 mt-0.5">Open the blank form to print or save</p>
                </div>
              </div>
            </button>
            <button onClick={() => setEbChoiceOpen(false)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {ebWizardOpen && <ElecDistributionWizard onClose={() => setEbWizardOpen(false)} />}

      {/* LV Box Record Choice Modal */}
      {edChoiceOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end justify-center" onClick={() => setEdChoiceOpen(false)}>
          <div className="w-full bg-white rounded-t-2xl p-6 pb-8 max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <FileText className="text-green-600 flex-shrink-0" size={24} />
              <div>
                <p className="font-bold text-gray-900 text-base">360S014ED – As-built LV Box Record</p>
                <p className="text-sm text-gray-500">How would you like to open this form?</p>
              </div>
            </div>
            <button onClick={() => { setEdChoiceOpen(false); setEdWizardOpen(true); }}
              className="w-full mb-3 p-4 rounded-xl border-2 text-left transition-all"
              style={{ borderColor: '#16a34a', background: '#f0fdf4' }}>
              <div className="flex items-center gap-3">
                <PenLine style={{ color: '#16a34a', flexShrink: 0 }} size={22} />
                <div>
                  <p className="font-semibold" style={{ color: '#14532d' }}>Fill Out Form</p>
                  <p className="text-xs mt-0.5" style={{ color: '#16a34a' }}>Step-by-step wizard — generates a filled PDF</p>
                </div>
              </div>
            </button>
            <button onClick={() => { setEdChoiceOpen(false); handleFormClick('forms/360S014ED.pdf', 'As-built LV Box Record', null); }}
              className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 text-left hover:bg-gray-100 active:bg-gray-200 transition-all">
              <div className="flex items-center gap-3">
                <ExternalLink className="text-gray-600 flex-shrink-0" size={22} />
                <div>
                  <p className="font-semibold text-gray-900">View / Download PDF</p>
                  <p className="text-xs text-gray-500 mt-0.5">Open the blank form to print or save</p>
                </div>
              </div>
            </button>
            <button onClick={() => setEdChoiceOpen(false)} className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {edWizardOpen && <LvBoxWizard onClose={() => setEdWizardOpen(false)} />}

      {/* Changelog Modal */}
      {changelogQueue.length > 0 && changelogQueue[changelogIdx] && (() => {
        const batch = changelogQueue[changelogIdx]
        const total = changelogQueue.length
        const current = changelogIdx + 1
        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
          }}>
            <div style={{
              background: 'white', borderRadius: 20, padding: '2rem',
              maxWidth: 480, width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              maxHeight: '80dvh', overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h2 style={{ fontWeight: 900, fontSize: '1.25rem', color: '#111827', margin: 0 }}>What's New</h2>
                {total > 1 && (
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{current} of {total}</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {batch.changes.map((item, i) => (
                  <div key={i} style={{ borderLeft: '3px solid #4f46e5', paddingLeft: '0.875rem' }}>
                    <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: 3, fontSize: '0.95rem' }}>{item.heading}</div>
                    {item.detail && (
                      <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5 }}>{item.detail}</div>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={dismissChangelog} style={{
                width: '100%', background: '#4f46e5', color: 'white',
                border: 'none', borderRadius: 12, padding: '0.875rem',
                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              }}>
                {current < total ? 'Next →' : 'Got it'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Install App Button */}
      {installPrompt && !installDismissed && (
        <div style={{
          position: 'fixed', bottom: '44px', left: '50%',
          transform: 'translateX(-50%)', zIndex: 1000,
          display: 'flex', gap: '8px', alignItems: 'center',
        }}>
          <button onClick={handleInstall} style={{
            background: '#4f46e5', color: 'white', border: 'none',
            borderRadius: '20px', padding: '10px 20px',
            fontSize: '14px', fontWeight: '700',
            boxShadow: '0 4px 12px rgba(79,70,229,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
          }}>⬇ Install App</button>
          <button onClick={() => setInstallDismissed(true)} style={{
            background: 'rgba(255,255,255,0.9)', border: 'none',
            borderRadius: '50%', width: '28px', height: '28px',
            cursor: 'pointer', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}>✕</button>
        </div>
      )}

      {/* Version Number */}
      <div style={{
        position: 'fixed', bottom: '12px', right: '12px',
        fontSize: '11px', color: '#6b7280',
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: '4px 8px', borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        userSelect: 'none', zIndex: 1000,
      }}>
        v{APP_VERSION}
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthGate>
      <AsBuiltFormSelector />
    </AuthGate>
  )
}

export default App;
