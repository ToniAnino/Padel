param([string]$src, [string]$dir, [string]$nombre, [double]$escala = 180)
# GLB de TRELLIS (una malla, sin esqueleto) -> OBJ + MTL + PNG para subir a Mixamo
$b = [IO.File]::ReadAllBytes($src)
$len = [BitConverter]::ToUInt32($b, 12)
$o = [Text.Encoding]::UTF8.GetString($b, 20, $len) | ConvertFrom-Json
$bin = 20 + $len + 8
function Vista($acc) { $bv = $o.bufferViews[$acc.bufferView]; $off = $bin + [int]$bv.byteOffset; if ($acc.byteOffset) { $off += [int]$acc.byteOffset }; return $off }
$p = $o.meshes[0].primitives[0]
$aP = $o.accessors[$p.attributes.POSITION]; $aU = $o.accessors[$p.attributes.TEXCOORD_0]; $aI = $o.accessors[$p.indices]
$oP = Vista $aP; $oU = Vista $aU; $oI = Vista $aI
New-Item -ItemType Directory -Force $dir | Out-Null
$inv = [Globalization.CultureInfo]::InvariantCulture
$sb = New-Object Text.StringBuilder
[void]$sb.AppendLine("mtllib $nombre.mtl")
[void]$sb.AppendLine("o $nombre")
# el modelo mide 1 de alto con los pies en -0.5: se sube al suelo y se escala a 180 cm
for ($i = 0; $i -lt $aP.count; $i++) {
  $x = [BitConverter]::ToSingle($b, $oP + 12 * $i) * $escala
  $y = ([BitConverter]::ToSingle($b, $oP + 12 * $i + 4) + 0.5) * $escala
  $z = [BitConverter]::ToSingle($b, $oP + 12 * $i + 8) * $escala
  [void]$sb.AppendLine(("v {0:0.#####} {1:0.#####} {2:0.#####}" -f $x, $y, $z).Replace(',', '.'))
}
for ($i = 0; $i -lt $aU.count; $i++) {
  $u = [BitConverter]::ToSingle($b, $oU + 8 * $i); $v = 1 - [BitConverter]::ToSingle($b, $oU + 8 * $i + 4)
  [void]$sb.AppendLine(("vt {0:0.######} {1:0.######}" -f $u, $v).Replace(',', '.'))
}
[void]$sb.AppendLine("usemtl piel")
$tam = if ($aI.componentType -eq 5125) { 4 } else { 2 }
for ($t = 0; $t -lt $aI.count / 3; $t++) {
  $f = @(0, 1, 2) | ForEach-Object { $k = $oI + $tam * (3 * $t + $_); $n = if ($tam -eq 4) { [BitConverter]::ToUInt32($b, $k) } else { [BitConverter]::ToUInt16($b, $k) }; $n + 1 }
  [void]$sb.AppendLine("f $($f[0])/$($f[0]) $($f[1])/$($f[1]) $($f[2])/$($f[2])")
}
[IO.File]::WriteAllText("$dir\$nombre.obj", $sb.ToString())
$img = $o.images[0]; $bv = $o.bufferViews[$img.bufferView]; $off = $bin + [int]$bv.byteOffset
$png = New-Object byte[] $bv.byteLength; [Array]::Copy($b, $off, $png, 0, $bv.byteLength)
[IO.File]::WriteAllBytes("$dir\$nombre.png", $png)
[IO.File]::WriteAllText("$dir\$nombre.mtl", "newmtl piel`r`nKa 1 1 1`r`nKd 1 1 1`r`nKs 0 0 0`r`nmap_Kd $nombre.png`r`n")
"v $($aP.count) vt $($aU.count) tris $($aI.count / 3)"
