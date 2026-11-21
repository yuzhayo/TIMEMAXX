param(
  [Parameter(Mandatory=$true)][long]$WindowHandle,
  [Parameter(Mandatory=$true)][double]$FractionX,
  [Parameter(Mandatory=$true)][double]$FractionY,
  [int]$DeltaX = 0,
  [int]$DeltaY = 0
)

# LOGIC — native pointer proof, restricted to the positively identified foreground window.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class FramePointerProof {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT {
    public int dx, dy; public uint mouseData, dwFlags, time; public UIntPtr dwExtraInfo;
  }
  [StructLayout(LayoutKind.Explicit)] public struct INPUTDATA { [FieldOffset(0)] public MOUSEINPUT mouse; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTDATA data; }
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr window, out RECT rect);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out RECT rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window, ref POINT point);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, INPUT[] input, int size);
  static void Button(uint flags) {
    var input = new INPUT { type = 0, data = new INPUTDATA { mouse = new MOUSEINPUT { dwFlags = flags } } };
    if (SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) != 1) throw new Exception("Native pointer input was not accepted");
  }
  public static int[] Run(long handle, double fx, double fy, int dx, int dy) {
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) throw new Exception("Pointer point must remain inside the target client area");
    IntPtr window = new IntPtr(handle);
    IntPtr previousDpi = SetThreadDpiAwarenessContext(new IntPtr(-4));
    POINT original; GetCursorPos(out original);
    bool pressed = false;
    try {
      SetForegroundWindow(window); Thread.Sleep(120);
      if (GetForegroundWindow() != window) throw new Exception("Proof window is not foreground; no mouse input sent");
      RECT client, before, after; POINT origin = new POINT();
      if (!GetClientRect(window, out client) || !GetWindowRect(window, out before) || !ClientToScreen(window, ref origin)) throw new Exception("Cannot resolve target window coordinates");
      int x = origin.X + (int)Math.Round((client.Right - client.Left) * fx);
      int y = origin.Y + (int)Math.Round((client.Bottom - client.Top) * fy);
      SetCursorPos(x, y); Thread.Sleep(40);
      Button(0x0002); pressed = true;
      for (int step = 1; step <= 12; step++) { SetCursorPos(x + dx * step / 12, y + dy * step / 12); Thread.Sleep(20); }
      Button(0x0004); pressed = false; Thread.Sleep(120);
      if (!GetWindowRect(window, out after)) throw new Exception("Cannot read the target after pointer input");
      return new int[] { before.Left, before.Top, after.Left, after.Top };
    } finally {
      if (pressed) Button(0x0004);
      SetCursorPos(original.X, original.Y);
      if (previousDpi != IntPtr.Zero) SetThreadDpiAwarenessContext(previousDpi);
    }
  }
}
'@
$rect = [FramePointerProof]::Run($WindowHandle, $FractionX, $FractionY, $DeltaX, $DeltaY)
[pscustomobject]@{ before = @($rect[0], $rect[1]); after = @($rect[2], $rect[3]); dx = $rect[2] - $rect[0]; dy = $rect[3] - $rect[1] } | ConvertTo-Json -Compress
