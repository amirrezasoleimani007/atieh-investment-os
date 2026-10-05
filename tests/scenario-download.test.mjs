import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../components/movement-path-v29.tsx',import.meta.url),'utf8');
test('backup action attaches and clicks a real download link in the user action',()=>{
  const body=source.split('const downloadBackup = (content:string,name:string) => {')[1].split('\n  };')[0];
  const events=[];let file;const link={click:()=>events.push('click'),remove:()=>events.push('remove')};
  const context={URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},Blob,Date,exportFile:null,setExportFile:value=>{file=value;},setLastBackupAt:()=>{},setNotice:()=>{},document:{createElement:()=>link,body:{appendChild:()=>events.push('attach')}}};
  vm.runInNewContext(`(function(content,name){${body}})('{"version":31}','backup.json')`,context);
  assert.deepEqual(events,['attach','click','remove']);assert.equal(link.download,'backup.json');assert.equal(link.href,'blob:test');assert.equal(file.content,'{"version":31}');
});
test('backup feedback does not falsely claim the file was saved to disk',()=>{
  assert.match(source,/درخواست دانلود ارسال شد/);assert.match(source,/دانلود مجدد فایل/);
  assert.doesNotMatch(source,/فایل پشتیبان با موفقیت در پوشه دانلودها ذخیره شد/);
});
test('scenario management separates archive and exposes save and transfer status',()=>{
  const controls=fs.readFileSync(new URL('../components/scenario-controls.tsx',import.meta.url),'utf8');
  assert.match(controls,/archivedIds.includes\(s.id\)===archiveTab/);
  assert.match(controls,/اصلاح‌شده پس از انتقال/);assert.match(controls,/lastSavedAt/);assert.match(controls,/دانلود پشتیبان کامل/);
});
