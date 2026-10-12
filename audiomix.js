// C#-helper voor "Geluid per app": ziet welke apps geluid maken en neemt elke app apart op (Windows "process loopback"),
// zodat je per app kunt bepalen hoe hard hij in je clip staat. Dit verandert NIET wat je zelf hoort.
// Aparte .exe naast audiocap.js: als dit niet compileert of niet werkt, blijft de gewone headset-opname gewoon werken.
// Modes:  apps <apparaat>   -> regels "sleutel<TAB>naam<TAB>1|0 (speelt nu)<TAB>niveau 0-100"
//         mixer <apparaat>  -> zet de mix van alle apps als f32le stereo 44100 Hz op stdout; stdin: "g<TAB>sleutel<TAB>procent"
// Exitcode 10 = deze Windows ondersteunt per-app opname niet (Wistic valt dan terug op de gewone opname).
module.exports = String.raw`
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

[StructLayout(LayoutKind.Sequential)] struct PROPERTYKEY { public Guid fmtid; public uint pid; }
[StructLayout(LayoutKind.Sequential)] struct PROPVARIANT { public ushort vt, r1, r2, r3; public IntPtr p; public IntPtr p2; }
[StructLayout(LayoutKind.Sequential)] struct PVBLOB { public ushort vt, r1, r2, r3; public uint cb; public IntPtr p; }

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
struct PROCESSENTRY32 {
  public uint dwSize, cntUsage, th32ProcessID; public IntPtr th32DefaultHeapID; public uint th32ModuleID, cntThreads, th32ParentProcessID;
  public int pcPriClassBase; public uint dwFlags;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom { }

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
  [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
  [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
  [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr c);
  [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr c);
}
[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
  [PreserveSig] int GetCount(out int n);
  [PreserveSig] int Item(int i, out IMMDevice d);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o);
  [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore ps);
  [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
  [PreserveSig] int GetState(out int state);
}
[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
  [PreserveSig] int GetCount(out int c);
  [PreserveSig] int GetAt(int i, out PROPERTYKEY k);
  [PreserveSig] int GetValue(ref PROPERTYKEY k, out PROPVARIANT v);
  [PreserveSig] int SetValue(IntPtr k, IntPtr v);
  [PreserveSig] int Commit();
}
[ComImport, Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioClient {
  [PreserveSig] int Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, IntPtr fmt, ref Guid session);
  [PreserveSig] int GetBufferSize(out uint n);
  [PreserveSig] int GetStreamLatency(out long l);
  [PreserveSig] int GetCurrentPadding(out uint n);
  [PreserveSig] int IsFormatSupported(int shareMode, IntPtr fmt, out IntPtr closest);
  [PreserveSig] int GetMixFormat(out IntPtr fmt);
  [PreserveSig] int GetDevicePeriod(out long def, out long min);
  [PreserveSig] int Start();
  [PreserveSig] int Stop();
  [PreserveSig] int Reset();
  [PreserveSig] int SetEventHandle(IntPtr h);
  [PreserveSig] int GetService(ref Guid riid, [MarshalAs(UnmanagedType.IUnknown)] out object o);
}
[ComImport, Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioCaptureClient {
  [PreserveSig] int GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong devPos, out ulong qpcPos);
  [PreserveSig] int ReleaseBuffer(uint frames);
  [PreserveSig] int GetNextPacketSize(out uint frames);
}

// ---- Sessies (welke apps maken geluid op dit apparaat) ----
[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionManager2 {
  [PreserveSig] int GetAudioSessionControl(IntPtr g, int flags, out IntPtr c);
  [PreserveSig] int GetSimpleAudioVolume(IntPtr g, int flags, out IntPtr v);
  [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator e);
  [PreserveSig] int RegisterSessionNotification(IntPtr n);
  [PreserveSig] int UnregisterSessionNotification(IntPtr n);
  [PreserveSig] int RegisterDuckNotification(IntPtr id, IntPtr n);
  [PreserveSig] int UnregisterDuckNotification(IntPtr n);
}
[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionEnumerator {
  [PreserveSig] int GetCount(out int n);
  [PreserveSig] int GetSession(int i, [MarshalAs(UnmanagedType.IUnknown)] out object s);
}
[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioSessionControl2 {
  [PreserveSig] int GetState(out int s);
  [PreserveSig] int GetDisplayName(out IntPtr n);
  [PreserveSig] int SetDisplayName(IntPtr n, IntPtr ctx);
  [PreserveSig] int GetIconPath(out IntPtr n);
  [PreserveSig] int SetIconPath(IntPtr n, IntPtr ctx);
  [PreserveSig] int GetGroupingParam(out Guid g);
  [PreserveSig] int SetGroupingParam(IntPtr g, IntPtr ctx);
  [PreserveSig] int RegisterAudioSessionNotification(IntPtr n);
  [PreserveSig] int UnregisterAudioSessionNotification(IntPtr n);
  [PreserveSig] int GetSessionIdentifier(out IntPtr id);
  [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr id);
  [PreserveSig] int GetProcessId(out uint pid);
  [PreserveSig] int IsSystemSoundsSession();
  [PreserveSig] int SetDuckingPreference(int optOut);
}
[ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioMeterInformation {
  [PreserveSig] int GetPeakValue(out float peak);
}

// ---- Volume per app (zoals de Windows-volumemixer): verandert ook wat je zelf hoort ----
[ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface ISimpleAudioVolume {
  [PreserveSig] int SetMasterVolume(float level, ref Guid ctx);
  [PreserveSig] int GetMasterVolume(out float level);
  [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid ctx);
  [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
}

// ---- Per-app opname (process loopback) ----
[ComImport, Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IActivateAudioInterfaceAsyncOperation {
  [PreserveSig] int GetActivateResult(out int activateResult, [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
}
[ComImport, Guid("41D949AB-9862-444A-80F6-C261334DA5EB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IActivateAudioInterfaceCompletionHandler {
  [PreserveSig] int ActivateCompleted(IActivateAudioInterfaceAsyncOperation op);
}
[ComImport, Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAgileObject { }

static class N {
  [DllImport("Mmdevapi.dll", ExactSpelling = true, PreserveSig = false)]
  public static extern void ActivateAudioInterfaceAsync([MarshalAs(UnmanagedType.LPWStr)] string path, ref Guid riid, IntPtr parms, IActivateAudioInterfaceCompletionHandler handler, out IActivateAudioInterfaceAsyncOperation op);
  [DllImport("ole32.dll")] public static extern int PropVariantClear(ref PROPVARIANT pv);
  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool Process32FirstW(IntPtr h, ref PROCESSENTRY32 e);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern bool Process32NextW(IntPtr h, ref PROCESSENTRY32 e);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
}

class Handler : IActivateAudioInterfaceCompletionHandler, IAgileObject {
  public ManualResetEvent Done = new ManualResetEvent(false);
  public int Hr = -1; public object Iface;
  public int ActivateCompleted(IActivateAudioInterfaceAsyncOperation op) {
    try { int r; object o; int h = op.GetActivateResult(out r, out o); Hr = (h != 0) ? h : r; Iface = o; }
    catch (Exception) { Hr = -1; }
    Done.Set(); return 0;
  }
}

// Eén app die opgenomen wordt. Een eigen thread zet de geluidsdata in een kleine buffer; de mixer haalt hem er in vaste stapjes uit.
class Src {
  public const int RATE = 44100;
  public uint Pid; public string Key; public long LastActive; public volatile bool Dead; public string Err = "";
  IAudioClient ac; IAudioCaptureClient cap; EventWaitHandle ev; Thread th;
  float[] ring = new float[RATE * 2 * 2]; int rd = 0, cnt = 0; bool primed = false; object lk = new object();
  public Src(uint pid, string key) { Pid = pid; Key = key; }

  // Sommige Windows-versies weigeren bepaalde stream-vlaggen (0x88890021 = ongeldige vlag). Daarom meerdere combinaties proberen.
  public bool Start() {
    int[] fl = new int[] { 0x00060000, unchecked((int)0x88060000), 0x000E0000 };   // LOOPBACK|EVENT / +AUTOCONVERT+SRC / +NOPERSIST
    string errs = "";
    foreach (int f in fl) {
      if (Try(f)) return true;
      errs += (errs.Length > 0 ? "; " : "") + Err + "@" + f.ToString("X");
      ac = null; cap = null;
    }
    Err = errs; return false;
  }

  bool Try(int flags) {
    IntPtr pp = IntPtr.Zero, pvp = IntPtr.Zero, fmt = IntPtr.Zero;
    try {
      pp = Marshal.AllocHGlobal(12);
      Marshal.WriteInt32(pp, 0, 1);                       // AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK
      Marshal.WriteInt32(pp, 4, unchecked((int)Pid));     // proces
      Marshal.WriteInt32(pp, 8, 0);                       // INCLUDE_TARGET_PROCESS_TREE
      PVBLOB pv = new PVBLOB(); pv.vt = 65; pv.cb = 12; pv.p = pp;   // VT_BLOB
      pvp = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(PVBLOB)));
      Marshal.StructureToPtr(pv, pvp, false);
      Handler h = new Handler();
      Guid iid = new Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");
      IActivateAudioInterfaceAsyncOperation op;
      N.ActivateAudioInterfaceAsync("VAD\\Process_Loopback", ref iid, pvp, h, out op);
      if (!h.Done.WaitOne(5000)) { Err = "timeout"; return false; }
      if (h.Hr != 0 || h.Iface == null) { Err = "activate 0x" + h.Hr.ToString("X"); return false; }
      ac = (IAudioClient)h.Iface;
      fmt = Marshal.AllocHGlobal(18);                     // WAVEFORMATEX: PCM, 2 kanalen, 44100 Hz, 16 bit
      Marshal.WriteInt16(fmt, 0, 1); Marshal.WriteInt16(fmt, 2, 2); Marshal.WriteInt32(fmt, 4, RATE); Marshal.WriteInt32(fmt, 8, RATE * 4);
      Marshal.WriteInt16(fmt, 12, 4); Marshal.WriteInt16(fmt, 14, 16); Marshal.WriteInt16(fmt, 16, 0);
      Guid sg = Guid.Empty;
      int hr = ac.Initialize(0, flags, 200000L, 0L, fmt, ref sg);
      if (hr != 0) { Err = "init 0x" + hr.ToString("X"); return false; }
      ev = new EventWaitHandle(false, EventResetMode.AutoReset);
      hr = ac.SetEventHandle(ev.SafeWaitHandle.DangerousGetHandle());
      if (hr != 0) { Err = "event 0x" + hr.ToString("X"); return false; }
      Guid ic = new Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"); object o2;
      if (ac.GetService(ref ic, out o2) != 0) { Err = "service"; return false; }
      cap = (IAudioCaptureClient)o2;
      if (ac.Start() != 0) { Err = "start"; return false; }
      th = new Thread(Run); th.IsBackground = true; th.Start();
      return true;
    } catch (Exception e) { Err = e.GetType().Name + ": " + e.Message; return false; }
    finally {
      if (pp != IntPtr.Zero) Marshal.FreeHGlobal(pp);
      if (pvp != IntPtr.Zero) Marshal.FreeHGlobal(pvp);
      if (fmt != IntPtr.Zero) Marshal.FreeHGlobal(fmt);
    }
  }

  void Run() {
    try {
      while (!Dead) {
        ev.WaitOne(200);
        uint n;
        while (!Dead) {
          if (cap.GetNextPacketSize(out n) != 0) { Dead = true; return; }
          if (n == 0) break;
          IntPtr data; uint frames, flags; ulong a, b;
          if (cap.GetBuffer(out data, out frames, out flags, out a, out b) != 0) { Dead = true; return; }
          int k = (int)frames * 2;
          float[] f = new float[k];
          if ((flags & 2) == 0) {                          // 2 = AUDCLNT_BUFFERFLAGS_SILENT
            short[] s = new short[k]; Marshal.Copy(data, s, 0, k);
            for (int i = 0; i < k; i++) f[i] = s[i] / 32768f;
          }
          cap.ReleaseBuffer(frames);
          Push(f, k);
        }
      }
    } catch (Exception) { Dead = true; }
  }

  void Push(float[] f, int n) {
    lock (lk) {
      if (n > ring.Length) n = ring.Length;
      int free = ring.Length - cnt;
      if (n > free) { int drop = n - free; rd = (rd + drop) % ring.Length; cnt -= drop; }
      int wr = (rd + cnt) % ring.Length;
      for (int i = 0; i < n; i++) { ring[wr] = f[i]; wr++; if (wr == ring.Length) wr = 0; }
      cnt += n;
    }
  }
  // Haalt n getallen uit de buffer. Heel even wachten (30 ms) voordat hij begint, zodat er geen tikjes/gaatjes in het geluid komen.
  public int Pop(float[] dst, int n) {
    lock (lk) {
      int hi = RATE * 2 * 3 / 10, lo = RATE * 2 / 10, prime = RATE * 2 * 3 / 100;
      if (cnt > hi) { int d = cnt - lo; d -= d % 2; rd = (rd + d) % ring.Length; cnt -= d; }   // te veel opgebouwd: vertraging weer wegwerken
      if (!primed) { if (cnt >= prime) primed = true; else return 0; }
      int m = Math.Min(n, cnt);
      for (int i = 0; i < m; i++) { dst[i] = ring[rd]; rd++; if (rd == ring.Length) rd = 0; }
      cnt -= m;
      if (m < n) primed = false;
      return m;
    }
  }
  public void Stop() {
    Dead = true;
    try { if (ac != null) ac.Stop(); } catch (Exception) { }
    try { if (ev != null) ev.Set(); } catch (Exception) { }
  }
}

class Sess { public uint Pid; public string Key, Disp; public int State; public float Peak; public object Ctl; }

static class P {
  static string NameOf(IMMDevice d) {
    try {
      IPropertyStore ps; if (d.OpenPropertyStore(0, out ps) != 0) return "";
      PROPERTYKEY k = new PROPERTYKEY(); k.fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"); k.pid = 14;
      PROPVARIANT v; if (ps.GetValue(ref k, out v) != 0) return "";
      string s = (v.vt == 31 && v.p != IntPtr.Zero) ? Marshal.PtrToStringUni(v.p) : "";
      N.PropVariantClear(ref v);
      return s;
    } catch (Exception) { return ""; }
  }
  static List<KeyValuePair<string, IMMDevice>> Outputs(IMMDeviceEnumerator en) {
    var list = new List<KeyValuePair<string, IMMDevice>>();
    IMMDeviceCollection col; if (en.EnumAudioEndpoints(0, 1, out col) != 0) return list;
    int n; col.GetCount(out n);
    for (int i = 0; i < n; i++) { IMMDevice d; if (col.Item(i, out d) == 0) list.Add(new KeyValuePair<string, IMMDevice>(NameOf(d), d)); }
    return list;
  }
  static IMMDevice Find(string name) {
    var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
    if (!string.IsNullOrEmpty(name) && name.ToLowerInvariant() != "default") {
      var outs = Outputs(en);
      foreach (var kv in outs) if (string.Equals(kv.Key, name, StringComparison.OrdinalIgnoreCase)) return kv.Value;
      foreach (var kv in outs) if (kv.Key.IndexOf(name, StringComparison.OrdinalIgnoreCase) >= 0) return kv.Value;
      Console.Error.WriteLine("Device niet gevonden, default gebruikt: " + name);
    }
    IMMDevice dev; if (en.GetDefaultAudioEndpoint(0, 1, out dev) != 0) return null;
    return dev;
  }
  static void Out(string s) {
    byte[] b = new UTF8Encoding(false).GetBytes(s);
    Stream so = Console.OpenStandardOutput(); so.Write(b, 0, b.Length); so.Flush();
  }

  static Dictionary<uint, string[]> names = new Dictionary<uint, string[]>();
  static string[] PName(uint pid) {
    string[] r;
    if (names.TryGetValue(pid, out r)) return r;
    try {
      Process p = Process.GetProcessById((int)pid);
      string key = p.ProcessName.ToLowerInvariant(), d = "";
      try { d = p.MainModule.FileVersionInfo.FileDescription; } catch (Exception) { }
      if (string.IsNullOrEmpty(d) || d.Trim().Length == 0 || d.Length > 40) d = p.ProcessName;
      r = new string[] { key, d.Trim() };
    } catch (Exception) { r = null; }
    names[pid] = r;
    return r;
  }
  // Eigen geluiden van Wistic / PowerShell (het "clip opgeslagen"-geluid) horen er niet bij.
  static bool Skip(string key) { return key.StartsWith("wistic") || key.StartsWith("blips-audio") || key == "electron" || key == "powershell" || key == "audiodg"; }

  static Dictionary<uint, uint> Parents() {
    var d = new Dictionary<uint, uint>();
    IntPtr h = N.CreateToolhelp32Snapshot(2, 0);
    if (h == IntPtr.Zero || h == new IntPtr(-1)) return d;
    try {
      PROCESSENTRY32 e = new PROCESSENTRY32(); e.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
      bool ok = N.Process32FirstW(h, ref e);
      while (ok) { d[e.th32ProcessID] = e.th32ParentProcessID; e.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32)); ok = N.Process32NextW(h, ref e); }
    } finally { N.CloseHandle(h); }
    return d;
  }
  static bool IsAnc(Dictionary<uint, uint> par, uint child, uint anc) {
    uint cur = child;
    for (int k = 0; k < 12; k++) { uint pp; if (!par.TryGetValue(cur, out pp) || pp == 0) break; if (pp == anc) return true; cur = pp; }
    return false;
  }
  // Een app niet dubbel opnemen: "process loopback" neemt een proces EN al zijn kindprocessen op (bv. Chrome, Discord).
  static List<Sess> Pick(List<Sess> cand, Dictionary<uint, uint> par) {
    var keep = new List<Sess>();
    foreach (Sess s in cand) {
      bool drop = false;
      foreach (Sess t in cand) {
        if (t.Pid == s.Pid) continue;
        if (t.Key == s.Key && IsAnc(par, s.Pid, t.Pid)) drop = true;    // t is de ouder met hetzelfde programma: zit al in zijn boom
        if (t.Key != s.Key && IsAnc(par, t.Pid, s.Pid)) drop = true;    // s is de ouder van een ander programma: liever het kind (apart instelbaar)
      }
      if (!drop) keep.Add(s);
    }
    return keep;
  }

  static List<Sess> Sessions(IMMDevice dev) {
    var list = new List<Sess>();
    try {
      Guid iid = new Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"); object o;
      if (dev.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) return list;
      IAudioSessionManager2 mgr = (IAudioSessionManager2)o;
      IAudioSessionEnumerator en; if (mgr.GetSessionEnumerator(out en) != 0) return list;
      int n; en.GetCount(out n);
      for (int i = 0; i < n; i++) {
        object so; if (en.GetSession(i, out so) != 0 || so == null) continue;
        try {
          IAudioSessionControl2 c2 = (IAudioSessionControl2)so;
          int st; if (c2.GetState(out st) != 0 || st == 2) continue;      // 2 = verlopen
          if (c2.IsSystemSoundsSession() == 0) continue;                   // Windows-systeemgeluiden overslaan
          uint pid; if (c2.GetProcessId(out pid) != 0 || pid == 0) continue;
          string[] nm = PName(pid); if (nm == null || Skip(nm[0])) continue;
          float pk = 0f; IAudioMeterInformation m = so as IAudioMeterInformation; if (m != null) m.GetPeakValue(out pk);
          Sess s = new Sess(); s.Pid = pid; s.Key = nm[0]; s.Disp = nm[1]; s.State = st; s.Peak = pk; s.Ctl = so;
          list.Add(s);
        } catch (Exception) { }
      }
    } catch (Exception) { }
    return list;
  }

  static int Apps(string name) {
    IMMDevice dev = Find(name); if (dev == null) return 2;
    var disp = new Dictionary<string, string>(); var act = new Dictionary<string, bool>(); var peak = new Dictionary<string, float>();
    for (int k = 0; k < 8; k++) {
      foreach (Sess s in Sessions(dev)) {
        disp[s.Key] = s.Disp;
        bool a0; act.TryGetValue(s.Key, out a0); act[s.Key] = a0 || s.State == 1;
        float p0; peak.TryGetValue(s.Key, out p0); if (s.Peak > p0) peak[s.Key] = s.Peak; else if (!peak.ContainsKey(s.Key)) peak[s.Key] = p0;
      }
      Thread.Sleep(50);
    }
    StringBuilder sb = new StringBuilder();
    foreach (KeyValuePair<string, string> kv in disp)
      sb.Append(kv.Key).Append('\t').Append(kv.Value.Replace('\t', ' ')).Append('\t').Append(act[kv.Key] ? "1" : "0").Append('\t').Append((int)(Math.Sqrt(peak[kv.Key]) * 100)).Append('\n');
    Out(sb.ToString());
    return 0;
  }

  static Dictionary<string, float> gains = new Dictionary<string, float>();
  static object gl = new object();
  static float GainOf(string key) { lock (gl) { float g; return gains.TryGetValue(key, out g) ? g : 1f; } }

  // Echte app-volumes (0..1), gezet via stdin-regels "v<TAB>sleutel<TAB>procent". liveSeq telt mee bij elke wijziging.
  static Dictionary<string, float> live = new Dictionary<string, float>();
  static volatile int liveSeq = 0;
  static void ApplyLive(List<Sess> all, HashSet<uint> done, bool force) {
    Dictionary<string, float> snap; lock (gl) snap = new Dictionary<string, float>(live);
    if (snap.Count == 0) return;
    var present = new HashSet<uint>(); foreach (Sess s in all) present.Add(s.Pid);
    done.RemoveWhere(delegate(uint p) { return !present.Contains(p); });
    foreach (Sess s in all) {
      float v; if (!snap.TryGetValue(s.Key, out v)) continue;
      if (!force && done.Contains(s.Pid)) continue;
      try {
        ISimpleAudioVolume sv = s.Ctl as ISimpleAudioVolume;
        if (sv == null) { Console.Error.WriteLine("[mix] geen volume-regeling voor " + s.Key); continue; }
        Guid g0 = Guid.Empty;
        int hr = sv.SetMasterVolume(Math.Max(0f, Math.Min(1f, v)), ref g0);
        if (hr == 0) { done.Add(s.Pid); Console.Error.WriteLine("[mix] volume " + s.Key + " (pid " + s.Pid + ") = " + (int)Math.Round(v * 100) + "%"); }
        else Console.Error.WriteLine("[mix] volume zetten mislukt voor " + s.Key + ": 0x" + hr.ToString("X"));
      } catch (Exception e) { Console.Error.WriteLine("[mix] volume-fout " + s.Key + ": " + e.Message); }
    }
  }

  static int Mixer(string name) {
    IMMDevice dev = Find(name); if (dev == null) { Console.Error.WriteLine("Kan uitvoerapparaat niet openen"); return 2; }
    Thread rt = new Thread(delegate() {
      try {
        string l;
        while ((l = Console.In.ReadLine()) != null) {
          string[] p = l.Split('\t');
          float v;
          if (p.Length == 3 && p[0] == "g" && float.TryParse(p[2], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out v))
            lock (gl) { gains[p[1]] = Math.Max(0f, v / 100f); }
          else if (p.Length == 3 && p[0] == "v" && float.TryParse(p[2], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out v)) {
            lock (gl) { live[p[1]] = Math.Max(0f, Math.Min(1f, v / 100f)); }
            liveSeq++;
          }
        }
      } catch (Exception) { }
    });
    rt.IsBackground = true; rt.Start();

    var srcs = new Dictionary<uint, Src>(); var retry = new Dictionary<uint, long>();
    bool okEver = false; int fails = 0;
    Stream so = Console.OpenStandardOutput();
    Stopwatch sw = Stopwatch.StartNew();
    long written = 0, nextScan = 0, lastScan = -1000; int RATE = Src.RATE;
    int appliedSeq = -1; var liveDone = new HashSet<uint>();
    Console.Error.WriteLine("[mix] mixer gestart");
    while (true) {
      Thread.Sleep(10);
      long now = sw.ElapsedMilliseconds;
      if (now >= nextScan || (liveSeq != appliedSeq && now >= lastScan + 100)) {
        nextScan = now + 1000; lastScan = now;
        List<Sess> all = Sessions(dev);
        int sq = liveSeq; ApplyLive(all, liveDone, sq != appliedSeq); appliedSeq = sq;
        List<Sess> cand = new List<Sess>();
        foreach (Sess s in all) {
          Src c0; bool have = srcs.TryGetValue(s.Pid, out c0);
          if (have && s.State == 1) c0.LastActive = now;
          if (have || s.State == 1) cand.Add(s);
        }
        List<Sess> pick = Pick(cand, Parents());
        var gone = new List<uint>();
        foreach (KeyValuePair<uint, Src> kv in srcs) {
          bool want = false; foreach (Sess s in pick) if (s.Pid == kv.Key) want = true;
          if (!want || kv.Value.Dead || now - kv.Value.LastActive > 10000) gone.Add(kv.Key);
        }
        foreach (uint id in gone) { srcs[id].Stop(); srcs.Remove(id); }
        foreach (Sess s in pick) {
          if (srcs.ContainsKey(s.Pid) || s.State != 1) continue;
          long ra; if (retry.TryGetValue(s.Pid, out ra) && now < ra) continue;
          Src ns = new Src(s.Pid, s.Key);
          if (ns.Start()) { ns.LastActive = now; srcs[s.Pid] = ns; okEver = true; fails = 0; Console.Error.WriteLine("[mix] neemt op: " + s.Key + " (pid " + s.Pid + ")"); }
          else {
            retry[s.Pid] = now + 5000; fails++;
            Console.Error.WriteLine("App-opname mislukt voor " + s.Key + ": " + ns.Err);
            if (!okEver && fails >= 3) return 10;   // werkt niet op deze Windows -> terugvallen op gewone opname
          }
        }
      }
      long need = now * RATE / 1000 - written;
      if (need <= 0) continue;
      if (need > RATE * 2L) { written += need - RATE * 2L; need = RATE * 2L; }
      int n2 = (int)need * 2;
      float[] mix = new float[n2], tmp = new float[n2];
      foreach (Src s in srcs.Values) {
        int got = s.Pop(tmp, n2);
        float g = GainOf(s.Key);
        if (g <= 0f) continue;
        for (int i = 0; i < got; i++) mix[i] += tmp[i] * g;
      }
      for (int i = 0; i < n2; i++) { if (mix[i] > 1f) mix[i] = 1f; else if (mix[i] < -1f) mix[i] = -1f; }
      byte[] bytes = new byte[n2 * 4]; Buffer.BlockCopy(mix, 0, bytes, 0, bytes.Length);
      so.Write(bytes, 0, bytes.Length); so.Flush();
      written += need;
    }
  }

  // Alleen app-volumes zetten (geen opname). Werkt ook als per-app opname niet kan. Stopt zodra Wistic stdin sluit.
  static volatile bool stdinClosed = false;
  static int Vol(string name) {
    IMMDevice dev = Find(name); if (dev == null) { Console.Error.WriteLine("[vol] kan uitvoerapparaat niet openen"); return 2; }
    Console.Error.WriteLine("[vol] gestart");
    Thread rt = new Thread(delegate() {
      try {
        string l;
        while ((l = Console.In.ReadLine()) != null) {
          string[] p = l.Split('\t'); float v;
          if (p.Length == 3 && p[0] == "v" && float.TryParse(p[2], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out v)) {
            lock (gl) { live[p[1]] = Math.Max(0f, Math.Min(1f, v / 100f)); }
            liveSeq++;
          }
        }
      } catch (Exception) { }
      stdinClosed = true;
    });
    rt.IsBackground = true; rt.Start();
    int appliedSeq = -1; var done = new HashSet<uint>();
    Stopwatch sw = Stopwatch.StartNew(); long next = 0;
    while (!stdinClosed) {
      Thread.Sleep(50);
      long now = sw.ElapsedMilliseconds;
      if (now >= next || liveSeq != appliedSeq) {
        next = now + 1000;
        int sq = liveSeq;
        ApplyLive(Sessions(dev), done, sq != appliedSeq); appliedSeq = sq;
      }
    }
    return 0;
  }

  static int Main(string[] args) {
    try {
      string mode = args.Length > 0 ? args[0] : "";
      string name = args.Length > 1 ? args[1] : "";
      if (mode == "apps") return Apps(name);
      if (mode == "mixer") return Mixer(name);
      if (mode == "vol") return Vol(name);
      return 1;
    } catch (Exception e) { try { Console.Error.WriteLine(e.Message); } catch (Exception) { } return 9; }
  }
}
`;
