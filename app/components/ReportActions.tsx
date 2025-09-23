
'use client';
import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type Props = {
  data: any;
  msText: string;
}

function toCSV(objArray: any[]): string{
  if(!objArray || !objArray.length) return '';
  const headers = Array.from(new Set(objArray.flatMap(o => Object.keys(o))));
  const lines = [headers.join(',')];
  for(const o of objArray){
    const row = headers.map(h => {
      const v = (o[h] ?? '').toString().replaceAll('"','""');
      return '"' + v + '"';
    }).join(',');
    lines.push(row);
  }
  return lines.join('\n');
}

export default function ReportActions({ data, msText }: Props){
  const onExportPDF = useCallback(async () => {
    const el = document.getElementById('report');
    if(!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 40;
    const imgHeight = canvas.height * (imgWidth / canvas.width);
    let y = 20;
    pdf.addImage(imgData, 'PNG', 20, y, imgWidth, imgHeight);
    pdf.save('lp-report.pdf');
  }, []);

  const onExportCSV = useCallback(() => {
    const rows: any[] = [];
    rows.push({ section: 'ManagementSummary', text: msText });
    if(data && data.checks){
      for(const c of data.checks){
        rows.push({ section: 'Check', key: c.key, label: c.label, score: c.score, weight: c.weight, details: c.details });
      }
    }
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lp-feedback.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, msText]);

  return (
    <div className="row" style={{gap:8, marginTop:8}}>
      <button className="secondary" onClick={onExportCSV}>Export CSV (Feedback)</button>
      <button onClick={onExportPDF}>Export PDF</button>
      <a className="badge" href="/example/leadgen" style={{display:'inline-flex', alignItems:'center'}}>Example Leadgen</a>
    </div>
  );
}
