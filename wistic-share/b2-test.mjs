// Controleert onze SigV4-handtekening tegen de officiële voorbeeldvector van AWS.
// De videostreaming van B2 hangt volledig van deze handtekening af, dus die moet kloppen.
// Uitvoeren: node b2-test.mjs   (staat bewust buiten de Worker, wordt niet meegeüpload)
import { b2GetUrl } from './src/b2.js';

const env = {
  B2_BUCKET: 'examplebucket',
  B2_REGION: 'us-east-1',
  B2_HOST: 's3.amazonaws.com',                 // alleen voor deze test; B2 gebruikt s3.<regio>.backblazeb2.com
  B2_VHOST: '1',                                // bucket in de host, zoals in het AWS-voorbeeld
  B2_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
  B2_APP_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
};
const when = new Date('2013-05-24T00:00:00Z');
const url = await b2GetUrl(env, 'test.txt', 86400, '', when);
const sig = (url.match(/X-Amz-Signature=([0-9a-f]+)/) || [])[1] || '';
const verwacht = 'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404';

console.log('URL     :', url);
console.log('krijg   :', sig);
console.log('verwacht:', verwacht);
console.log(sig === verwacht ? '\nGOED: de handtekening klopt exact (zelfde als de AWS-documentatie).' : '\nFOUT: de handtekening wijkt af.');
process.exit(sig === verwacht ? 0 : 1);