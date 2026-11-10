/* Portable TripTogether financial backup XLSX. No network or third-party packages.
 * Financial definitions mirror finance.js. Original snapshot included verbatim.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TripTogetherExcelBackup=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 // XML 1.0 forbids most control characters and lone surrogates; one pasted \u000b would make
 // Excel reject the whole workbook, so drop them before escaping.
 const XML_INVALID=/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
 const xml=s=>String(s??'').replace(XML_INVALID,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const enc=new TextEncoder();
 const number=x=>Number(x||0);
 const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
 const c=(v,f)=>({v,f});
 const range=(sheet,col,count)=>"'"+sheet+"'!"+col+"2:"+col+Math.max(2,count+1);
 function workbook(input){
  const trip=input.trip||{};
  const members=[...(input.members||[])],expenses=[...(input.expenses||[])],contributions=[...(input.contributions||[])],debts=[...(input.debts||[])],payments=[...(input.payments||[])],reminders=[...(input.reminders||[])];
  const F=(typeof TripTogetherFinance!=='undefined'&&TripTogetherFinance) || (typeof window!=='undefined'&&window.TripTogetherFinance);
  if(!F)throw Error('Không thể xuất Excel khi chưa tải bộ tính toán TripTogether.');
  const enrichedRecords=F.applyPayments(expenses,debts,payments);
  const enrichedExpenses=enrichedRecords.expenses,enrichedDebts=enrichedRecords.debts;
  const totals=F.calculateTotals(trip,enrichedExpenses,contributions);
  const memberBalances=F.calculateMemberBalances(members,enrichedExpenses,contributions,totals);
  const debtBalances=F.calculateDebtBalances(members,enrichedDebts);
  const expenseTransfers=F.settle(memberBalances),debtTransfers=F.settle(debtBalances);
  const A='Phan bo chi phi';
  const allocationRows=[['ID khoan chi','Hang muc','ID thanh vien','Ten','Phan chi (VND)','Cach chia']];
  enrichedExpenses.forEach(e=>{
   const mode=e.split&&e.split.weights?e.split.mode:'ca nhom';
   for(const [id,value] of F.allocateExpense(e,members))allocationRows.push([e.id,e.title,id,(members.find(m=>m.user_id===id)||{}).name||'',value,mode]);
  });
  const ar=col=>range(A,col,allocationRows.length-1);
  const E='Khoan chi',P='Thanh toan',D='No rieng',C='Dong quy',M='Thanh vien',S='Tong quan';
  const er=col=>range(E,col,expenses.length),pr=col=>range(P,col,payments.length),dr=col=>range(D,col,debts.length),cr=col=>range(C,col,contributions.length);
  const expenseRows=[['ID','Ngay chi','Hang muc','Phan loai','ID nguoi ung','Nguoi tra','So tien','Da hoan (cu)','Ghi chu','Duong dan anh','Da hoan tu quy','Quy da chi','Quy con no','Nguoi tao','Ngay tao','Tien te','So tien goc','Ty gia (VND)','Cach chia (JSON)']];
  enrichedExpenses.forEach((e,i)=>{
   const n=i+2,a=number(e.amount),paid=number(e.paid_amount),fundPaid=e.payer_id?paid:a;
   expenseRows.push([e.id,e.spent_on,e.title,e.category,e.payer_id||'',e.payer_name,a,e.reimbursed?1:0,e.note||'',e.receipt_path||'',
    c(paid,'IF(E'+n+'="",0,IF(COUNTIF('+pr('C')+',A'+n+')>0,MIN(G'+n+',MAX(0,SUMIF('+pr('C')+',A'+n+','+pr('E')+'))),IF(H'+n+'=1,G'+n+',0)))'),
    c(fundPaid,'IF(E'+n+'="",G'+n+',K'+n+')'),c(e.payer_id?a-paid:0,'IF(E'+n+'="",0,MAX(0,G'+n+'-K'+n+'))'),e.created_by||'',e.created_at||'',e.currency||'VND',e.original_amount==null?'':Number(e.original_amount),e.fx_rate==null?'':Number(e.fx_rate),e.split?JSON.stringify(e.split):'']);
  });
  const contributionRows=[['ID','Ngay dong','ID nguoi dong','Ten nguoi dong','So tien','Ghi chu','Nguoi tao','Ngay tao']];
  contributions.forEach(x=>contributionRows.push([x.id,x.paid_on,x.payer_id,x.payer_name,number(x.amount),x.note||'',x.created_by||'',x.created_at||'']));
  const paymentRows=[['ID','Loai','ID khoan chi','ID khoan no','So tien (+/-)','Ngay thanh toan','Ghi chu','Nguoi ghi','Ngay tao']];
  payments.forEach(p=>paymentRows.push([p.id,p.expense_id?'Hoan khoan chi':'Tra no',p.expense_id||'',p.debt_id||'',number(p.amount),p.paid_on||'',p.note||'',p.recorded_by||'',p.created_at||'']));
  const debtRows=[['ID','Ngay no','ID nguoi no','ID chu no','So tien','Da tat toan (cu)','Ghi chu','Da thanh toan','Con no','Nguoi tao','Ngay tao']];
  enrichedDebts.forEach((d,i)=>{
   const n=i+2,a=number(d.amount),paid=number(d.paid_amount);
   debtRows.push([d.id,d.incurred_on,d.debtor_id,d.creditor_id,a,d.is_settled?1:0,d.note||'',
    c(paid,'IF(COUNTIF('+pr('D')+',A'+n+')>0,MIN(E'+n+',MAX(0,SUMIF('+pr('D')+',A'+n+','+pr('E')+'))),IF(F'+n+'=1,E'+n+',0))'),
    c(a-paid,'MAX(0,E'+n+'-H'+n+')'),d.created_by||'',d.created_at||'']);
  });
  const memberRows=[['ID thanh vien','Ten','Khach','Chi ca nhan','Da dong quy','Phan chi','Quy con no TV','Can doi quy (+nhan)','No rieng (+nhan)','Tai khoan lien ket']];
  memberBalances.forEach((m,i)=>{
   const n=i+2,db=debtBalances[i],raw=members[i];
   memberRows.push([m.id,m.name,m.is_guest?'Co':'Khong',
    c(number(m.paid),'SUMIF('+er('E')+',A'+n+','+er('G')+')'),
    c(number(m.contributed),'SUMIF('+cr('C')+',A'+n+','+cr('E')+')'),
    c(number(m.share),'SUMIF('+ar('C')+',A'+n+','+ar('E')+')'),
    c(number(m.outstanding),'SUMIF('+er('E')+',A'+n+','+er('M')+')'),
    c(number(m.b),'IFERROR(\'Tong quan\'!B4/\'Tong quan\'!B3+E'+n+'-F'+n+'-\'Tong quan\'!B11/\'Tong quan\'!B3,0)'),
    c(number(db.b),'SUMIF('+dr('D')+',A'+n+','+dr('I')+')-SUMIF('+dr('C')+',A'+n+','+dr('I')+')'),
    raw?.account_user_id||'']);
  });
  const summary=[
   ['Chi tieu','Gia tri / VND','Giai thich'],
   ['Chuyen di',trip.name||'',trip.id||''],
   ['So thanh vien',members.length,'So nguoi chia deu phan chi'],
   ['Quy ban dau',number(trip.initial_fund),'Quy co truoc cac lan dong them'],
   ['Tong chi',number(totals.spent),'Tong so tien cua moi khoan chi'],
   ['Dong quy them',number(totals.additional),'Tong so tien dong them'],
   ['Tong quy',number(totals.fund),'Quy ban dau + dong them'],
   ['Quy da chi',number(totals.fundPaid),'Quy tra truc tiep va da hoan cho nguoi ung'],
   ['Quy con no thanh vien',number(totals.dueToMembers),'Khoan nguoi ung chua duoc quy hoan'],
   ['Tien mat quy',number(totals.cashFund),'Tong quy - Quy da chi'],
   ['Quy thuc te',number(totals.actualFund),'Tien mat quy - Quy con no thanh vien'],
   ['Phan chi trung binh / nguoi',number(totals.spent)/Math.max(1,members.length),'Tong chi / so thanh vien (phan chi tung nguoi o sheet Thanh vien)'],
   ['No rieng con lai',enrichedDebts.reduce((n,d)=>n+Math.max(0,number(d.amount)-number(d.paid_amount)),0),'Khong cong vao can doi quy'],
   ['Xuat luc',new Date().toISOString(),'Ban sao tai thoi diem xuat'],
   ['Quy can du phong',reminders.reduce((sum,x)=>sum+Math.max(0,number(x.total_amount)-number(x.paid_amount)),0),'Chi la so tien du kien; chua tru vao tien mat quy'],
   ['Tien mat sau du phong',number(totals.actualFund)-reminders.reduce((sum,x)=>sum+Math.max(0,number(x.total_amount)-number(x.paid_amount)),0),'Tien mat quy tru di cac khoan can giu lai']
  ];
  const fm={
   3:null,
   5:'SUM('+er('G')+')',6:'SUM('+cr('E')+')',7:'B4+B6',
   8:'SUM('+er('L')+')',9:'SUM('+er('M')+')',10:'B7-B8',11:'B10-B9',
   12:'IFERROR(B5/B3,0)',13:'SUM('+dr('I')+')',15:'SUM('+range('Nhac quy','F',reminders.length)+')',16:'B11-B15'
  };
  Object.entries(fm).forEach(([row,f])=>{if(f)summary[Number(row)-1][1]=c(summary[Number(row)-1][1],f)});
  const transferRows=[['Loai','Nguoi chuyen','Nguoi nhan','So tien (VND)','Ghi chu']];
  expenseTransfers.forEach(x=>transferRows.push(['Can doi quy',x.from,x.to,number(x.amount),'Snapshot; xem Cong thuc de tinh lai neu sua du lieu']));
  debtTransfers.forEach(x=>transferRows.push(['No rieng',x.from,x.to,number(x.amount),'Snapshot; xem Cong thuc de tinh lai neu sua du lieu']));
  const notes=[
   ['TripTogether - Sao luu tai chinh','Ban sao doc lap voi website; mo bang Excel/LibreOffice.'],
   ['Nguon','Dữ liệu toàn bộ được lấy trực tiếp từ Supabase theo chuyến đi; không lọc theo giao diện.'],
   ['Du lieu goc','Trang JSON chua toan bo du lieu goc de doi chieu hoac khoi phuc thu cong.'],
   ['Phan chi','SUMIF(Phan bo chi phi.ID thanh vien, Thanh vien.ID, Phan bo chi phi.Phan chi). Khoan chia ca nhom = so tien / so thanh vien; khoan chia rieng = so tien x trong so cua nguoi do / tong trong so.'],
   ['Chi ca nhan','SUMIF(Khoan chi.ID nguoi ung, Thanh vien.ID, Khoan chi.So tien).'],
   ['Da hoan khoan chi','Neu co ban ghi thanh toan: MIN(so tien,MAX(0,SUMIF(Thanh toan.ID khoan chi, khoan chi.ID, so tien +/-))); neu khong: co Da hoan (cu) thi bang so tien, nguoc lai 0.'],
   ['Quy da chi tung khoan','Neu quy tra truc tiep: bang so tien. Neu nguoi ung: bang Da hoan tu quy.'],
   ['Quy con no nguoi ung','MAX(0, So tien - Da hoan tu quy) neu co nguoi ung; nguoc lai 0.'],
   ['Tien mat quy','Quy ban dau + Dong quy them - Quy da chi.'],
   ['Quy thuc te','Tien mat quy - Quy con no thanh vien.'],
   ['Can doi quy tung nguoi','(Quy ban dau / so thanh vien) + Da dong quy - Phan chi - (Quy thuc te / so thanh vien). Duong = nhan tien.'],
   ['No rieng con lai','Neu co thanh toan: MIN(so tien,MAX(0,SUMIF(Thanh toan.ID khoan no,...))); neu khong: da tat toan cu thi thanh toan day du.'],
   ['No rieng tung nguoi','Tong so du no rieng ma nguoi do la chu no - tong so du no rieng ma nguoi do no.'],
   ['Goi y chuyen tien','Theo dung finance.js: chon nguoi co can doi < -0.5 va > 0.5 theo thu tu thanh vien; chuyen MIN(no,co); ROUND so tien; lap toi khi het; tach quy va no rieng.'],
   ['Luu y sau sua du lieu','Cong thuc tinh tong va can doi tu cap nhat; bang Goi y chuyen tien la snapshot tai thoi diem xuat va can chay lai thuat toan neu thay doi so lieu.'],
   ['Anh hoa don','Bang chi co duong dan anh trong Supabase private Storage; can tai anh rieng de sao luu anh offline.'],
   ['Bao mat','File chua ID va chi tiet tai chinh; bao quan can than.'],
   ['Khong phai dong bo','Sua file Excel KHONG thay doi website/Supabase.'],
   ['Nhac quy','Khoan thanh toan du kien chi de du phong. Da coc/da tra KHONG tu tao chi phi hay giam tien trong quy. Khi thuc su chi, ghi them vao Khoan chi.']
  ];
  const reminderRows=[['ID','Noi dung','Tong phai tra','Da coc / da tra','Ngay den han','Can du phong','Ghi chu','Nguoi tao','Ngay tao']];
  reminders.forEach((item,i)=>{const row=i+2;reminderRows.push([item.id,item.title,number(item.total_amount),number(item.paid_amount),item.due_on||'',c(Math.max(0,number(item.total_amount)-number(item.paid_amount)),'MAX(0,C'+row+'-D'+row+')'),item.note||'',item.created_by||'',item.created_at||''])});
  const json=JSON.stringify({trip,members,expenses,contributions,debts,payments,reminders,exported_at:new Date().toISOString()});
  const rawRows=[['Du lieu JSON (noi cac phan theo thu tu tu tren xuong)'],...Array.from({length:Math.ceil(json.length/30000)},(_,i)=>[json.slice(i*30000,(i+1)*30000)])];
  const sheets=[
   {name:S,rows:summary},{name:M,rows:memberRows},{name:E,rows:expenseRows},
   {name:C,rows:contributionRows},{name:D,rows:debtRows},{name:P,rows:paymentRows},
   {name:'Goi y chuyen tien',rows:transferRows},{name:'Cong thuc',rows:notes},{name:'Du lieu goc JSON',rows:rawRows},{name:'Nhac quy',rows:reminderRows},{name:A,rows:allocationRows}
  ];
  return makeXlsx(sheets);
 }
 function sheetXML(rows){
  let body='';
  rows.forEach((row,i)=>{
   body+='<row r="'+(i+1)+'">';
   row.forEach((item,j)=>{
    if(item===undefined||item===null)return;
    const addr=column(j)+(i+1),value=(typeof item==='object'&&item!==null&&Object.hasOwn(item,'v'))?item.v:item;
    const formula=item&&typeof item==='object'&&item.f;
    if(formula){
     body+='<c r="'+addr+'" s="2"><f>'+xml(formula)+'</f><v>'+Number(value||0)+'</v></c>';
    }else if(typeof value==='number'&&Number.isFinite(value)){
     body+='<c r="'+addr+'" s="'+(i?2:1)+'"><v>'+value+'</v></c>';
    }else {
     const s=String(value);
     body+='<c r="'+addr+'" s="'+(i?0:1)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(s.slice(0,32767))+'</t></is></c>';
    }
   });
   body+='</row>';
  });
  const width=Math.max(1,...rows.map(x=>x.length));
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
   '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
   '<dimension ref="A1:'+column(width-1)+Math.max(1,rows.length)+'"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>'+
   '<sheetFormatPr defaultRowHeight="16"/><sheetData>'+body+'</sheetData></worksheet>';
 }
 const le16=(a,n)=>{a.push(n&255,(n>>>8)&255)};
 const le32=(a,n)=>{le16(a,n);le16(a,n>>>16)};
 const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 function crc(bytes){let n=-1;for(const b of bytes)n=(n>>>8)^crcTable[(n^b)&255];return(n^-1)>>>0}
 function zip(files){
  const chunks=[],central=[];let offset=0;
  const push=b=>{chunks.push(b);offset+=b.length};
  for(const file of files){
   const name=enc.encode(file[0]),data=typeof file[1]==='string'?enc.encode(file[1]):file[1],hash=crc(data);
   const start=offset,h=[];
   le32(h,0x04034b50);le16(h,20);le16(h,0);le16(h,0);le16(h,0);le16(h,0);
   le32(h,hash);le32(h,data.length);le32(h,data.length);le16(h,name.length);le16(h,0);
   push(new Uint8Array(h));push(name);push(data);
   const ct=[];
   le32(ct,0x02014b50);le16(ct,20);le16(ct,20);le16(ct,0);le16(ct,0);le16(ct,0);le16(ct,0);
   le32(ct,hash);le32(ct,data.length);le32(ct,data.length);le16(ct,name.length);le16(ct,0);le16(ct,0);
   le16(ct,0);le16(ct,0);le32(ct,0);le32(ct,start);central.push(new Uint8Array(ct),name);
  }
  const centralStart=offset;
  central.forEach(push);
  const end=[];le32(end,0x06054b50);le16(end,0);le16(end,0);le16(end,files.length);le16(end,files.length);
  le32(end,offset-centralStart);le32(end,centralStart);le16(end,0);push(new Uint8Array(end));
  const out=new Uint8Array(offset);let at=0;for(const b of chunks){out.set(b,at);at+=b.length}return out;
 }
 function makeXlsx(sheets){
  const types='<?xml version="1.0" encoding="UTF-8"?>'+
   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
   '<Default Extension="xml" ContentType="application/xml"/>'+
   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+
   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
   sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>';
  const workbook='<?xml version="1.0" encoding="UTF-8"?>'+
   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
   '<sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+
   '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
  const rels='<?xml version="1.0" encoding="UTF-8"?>'+
   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
   '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  const styles='<?xml version="1.0" encoding="UTF-8"?>'+
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>'+
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FF5546D7"/><sz val="11"/><name val="Calibri"/></font></fonts>'+
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'+
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'+
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'+
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>'+
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>';
  const files=[
   ['[Content_Types].xml',types],
   ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
   ['xl/workbook.xml',workbook],
   ['xl/_rels/workbook.xml.rels',rels],
   ['xl/styles.xml',styles],
   ...sheets.map((s,i)=>['xl/worksheets/sheet'+(i+1)+'.xml',sheetXML(s.rows)])
  ];
  return zip(files);
 }
 // Đ/đ have no NFD decomposition, so map them explicitly before stripping accents.
 function fileSafeName(name){
  return String(name||'chuyen-di').replace(/Đ/g,'D').replace(/đ/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'chuyen-di';
 }
 function download(snapshot){
  const bytes=workbook(snapshot);
  const filename='TripTogether-'+fileSafeName(snapshot.trip.name)+'-'+new Date().toISOString().slice(0,10)+'.xlsx';
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  return filename;
 }
 return {workbook,download,fileSafeName};
});
