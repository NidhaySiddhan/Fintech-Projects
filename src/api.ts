import { validateData, type Data } from './model';
export type Snapshot = {data:Data;revision:number};
export async function workspace(data?:Data,revision?:number):Promise<Snapshot> {
  const response=await fetch('/api/workspace',data ? {
    method:'PUT', headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision}),
  } : {cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw Error(result.error || 'Unable to save records.');
  if(!Number.isSafeInteger(result.revision)||result.revision<0) throw Error('Invalid server response.');
  return {data:validateData(result.data),revision:result.revision};
}
