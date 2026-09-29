vi.mock("react-native", () => ({ Platform:{OS:"ios",select:(o:any)=>o.ios??o.default}, Alert:{alert:()=>undefined} }));
vi.mock("expo-file-system", () => ({ readAsStringAsync: async ()=>"AA==", copyAsync: async ()=>undefined, EncodingType:{Base64:"base64"}, cacheDirectory:"/tmp/" }));
vi.mock("expo-image-picker", () => ({ requestMediaLibraryPermissionsAsync: async ()=>({status:"granted"}), requestCameraPermissionsAsync: async ()=>({status:"granted"}), launchImageLibraryAsync: async ()=>({canceled:true}), launchCameraAsync: async ()=>({canceled:true}) }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: async ()=>({canceled:true}) }));
vi.mock("expo-constants", () => ({ default:{expoConfig:{extra:{storeApiUrl:"https://api.test"}}} }));
vi.mock("@/lib/supabase/client", () => ({ supabase:{ from:()=>({}), auth:{ getSession: async ()=>({data:{session:{access_token:"t"}},error:null}), getUser: async ()=>({data:{user:{user_metadata:{}}},error:null}), updateUser: async ()=>({error:null}) } } }));
vi.mock("@/lib/api", () => ({ assertSellerCanOperate: async ()=>({ok:true}) }));
vi.mock("@/lib/api/backend", () => ({ addProductImageBackend: async ()=>({ok:true}) }));
vi.mock("@/lib/seller-access", () => ({}));
import { describe,it,expect,vi,beforeEach } from "vitest";
import { uploadAvatar, validateAvatarAsset } from "../upload";
if (typeof globalThis.atob!=="function") (globalThis as any).atob=(s:string)=>Buffer.from(s,"base64").toString("binary");
const fetchMock=vi.fn(); vi.stubGlobal("fetch",fetchMock);
describe("validateAvatarAsset",()=>{
  it("rejects heic",()=>{ expect(validateAvatarAsset("image/heic",100).ok).toBe(false); });
  it("rejects >5MB",()=>{ expect(validateAvatarAsset("image/jpeg",6*1024*1024).ok).toBe(false); });
  it("accepts jpeg under limit",()=>{ expect(validateAvatarAsset("image/jpeg",100).ok).toBe(true); });
});
describe("uploadAvatar presign shape",()=>{
  beforeEach(()=>{ fetchMock.mockReset(); fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({uploadUrl:"https://r2/upload",publicUrl:"https://cdn/avatars/x.jpg"})}).mockResolvedValueOnce({ok:true}); });
  it("sends bucket public + content_type + prefix=userId",async()=>{
    await uploadAvatar("user-123","file:///tmp/a.jpg",{mimeType:"image/jpeg",fileName:"a.jpg"});
    const body=JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.bucket).toBe("public");
    expect(body.content_type).toBe("image/jpeg");
    expect(body.prefix).toBe("user-123");
    expect(body.filename).toMatch(/\.jpg$/);
    expect("contentType" in body).toBe(false);
  });
});
