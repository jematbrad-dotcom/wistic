// C#-helper: neemt de audio op die een Windows-uitvoerapparaat (bv. je headset) afspeelt (WASAPI loopback).
// ffmpeg-static kan dit zelf niet (geen wasapi-input), daarom dit kleine hulpprogramma.
// Wordt bij de eerste start automatisch gecompileerd met csc.exe (zit standaard in Windows).
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

static class P {
  [DllImport("ole32.dll")] static extern int PropVariantClear(ref PROPVARIANT pv);

  static string NameOf(IMMDevice d) {
    try {
      IPropertyStore ps; if (d.OpenPropertyStore(0, out ps) != 0) return "";
      PROPERTYKEY k = new PROPERTYKEY(); k.fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"); k.pid = 14;
      PROPVARIANT v; if (ps.GetValue(ref k, out v) != 0) return "";
      string s = (v.vt == 31 && v.p != IntPtr.Zero) ? Marshal.PtrToStringUni(v.p) : "";
      PropVariantClear(ref v);
      return s;
    } catch { return ""; }
  }

  static List<KeyValuePair<string, IMMDevice>> Outputs(IMMDeviceEnumerator en) {
    var list = new List<KeyValuePair<string, IMMDevice>>();
    IMMDeviceCollection col; if (en.EnumAudioEndpoints(0, 1, out col) != 0) return list; // render, active
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

  static IAudioClient Open(string name, out IntPtr fmt) {
    fmt = IntPtr.Zero;
    IMMDevice dev = Find(name); if (dev == null) return null;
    Guid iid = new Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"); object o;
    if (dev.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) return null;
    IAudioClient ac = (IAudioClient)o;
    if (ac.GetMixFormat(out fmt) != 0) return null;
    return ac;
  }

  static int Main(string[] args) {
    try {
      string mode = args.Length > 0 ? args[0] : "";
      string name = args.Length > 1 ? args[1] : "";
      if (mode == "list") {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
        var sb = new StringBuilder();
        foreach (var kv in Outputs(en)) if (kv.Key != "") sb.Append(kv.Key).Append("\n");
        Out(sb.ToString()); return 0;
      }
      IntPtr pf; IAudioClient ac = Open(name, out pf);
      if (ac == null) { Console.Error.WriteLine("Kan uitvoerapparaat niet openen"); return 2; }
      int tag = (ushort)Marshal.ReadInt16(pf, 0), ch = Marshal.ReadInt16(pf, 2), rate = Marshal.ReadInt32(pf, 4), bits = Marshal.ReadInt16(pf, 14);
      bool isFloat = tag == 3;
      if (tag == 0xFFFE) isFloat = Marshal.ReadInt32(pf, 24) == 3;
      if (mode == "info") { Out(rate.ToString()); return 0; }
      if (mode != "capture") return 1;

      Guid sg = Guid.Empty;
      int hr = ac.Initialize(0, 0x00020000 /*LOOPBACK*/, 10000000L, 0, pf, ref sg);
      if (hr != 0) { Console.Error.WriteLine("Initialize mislukt: 0x" + hr.ToString("X")); return 3; }
      Guid ic = new Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"); object o2;
      if (ac.GetService(ref ic, out o2) != 0) return 4;
      IAudioCaptureClient cap = (IAudioCaptureClient)o2;
      if (ac.Start() != 0) return 5;

      Stream so = Console.OpenStandardOutput();
      Stopwatch sw = Stopwatch.StartNew();
      long written = 0;
      int bytesPer = bits / 8;
      while (true) {
        Thread.Sleep(10);
        uint n;
        while (true) {
          hr = cap.GetNextPacketSize(out n); if (hr != 0) return 6; // apparaat weg
          if (n == 0) break;
          IntPtr data; uint frames, flags; ulong a, b;
          if (cap.GetBuffer(out data, out frames, out flags, out a, out b) != 0) return 7;
          float[] outF = new float[frames * 2];
          if ((flags & 2) == 0) { // 2 = AUDCLNT_BUFFERFLAGS_SILENT
            for (int i = 0; i < frames; i++) {
              for (int c = 0; c < 2; c++) {
                int cc = (ch == 1) ? 0 : c;
                IntPtr src = IntPtr.Add(data, (i * ch + cc) * bytesPer);
                float v;
                if (isFloat && bits == 32) { int bi = Marshal.ReadInt32(src); v = BitConverter.ToSingle(BitConverter.GetBytes(bi), 0); }
                else if (bits == 16) v = Marshal.ReadInt16(src) / 32768f;
                else if (bits == 32) v = Marshal.ReadInt32(src) / 2147483648f;
                else if (bits == 24) { int x = Marshal.ReadByte(src, 0) | (Marshal.ReadByte(src, 1) << 8) | (Marshal.ReadByte(src, 2) << 16); if ((x & 0x800000) != 0) x |= unchecked((int)0xFF000000); v = x / 8388608f; }
                else v = 0f;
                outF[i * 2 + c] = v;
              }
            }
          }
          cap.ReleaseBuffer(frames);
          byte[] bytes = new byte[outF.Length * 4]; Buffer.BlockCopy(outF, 0, bytes, 0, bytes.Length);
          so.Write(bytes, 0, bytes.Length); written += frames;
        }
        // Loopback levert niets bij stilte -> vul aan met stilte zodat audio gelijk blijft lopen met video
        long expected = sw.ElapsedMilliseconds * rate / 1000;
        if (expected - written > rate / 50) {
          long pad = expected - written; if (pad > rate * 2L) pad = rate * 2L;
          byte[] z = new byte[pad * 8]; so.Write(z, 0, z.Length); written += pad;
        }
        so.Flush();
      }
    } catch (Exception e) { try { Console.Error.WriteLine(e.Message); } catch { } return 9; }
  }
}
`;
