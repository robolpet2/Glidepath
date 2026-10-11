#!/bin/bash
# usage: sheet.sh out.jpg t1 t2 ... (up to 12)
out=$1; shift; n=$#; inputs=""; f=""; i=0
for t in "$@"; do inputs="$inputs -i st/$t.jpg"; f="$f[$i]scale=480:270[s$i];"; i=$((i+1)); done
lay=""; for ((k=0;k<n;k++)); do c=$((k%4)); r=$((k/4)); lay="$lay$((c*480))_$((r*270))|"; done
for ((k=0;k<n;k++)); do f="$f[s$k]"; done
ffmpeg -loglevel error -y $inputs -filter_complex "${f}xstack=inputs=$n:layout=${lay%|}[o]" -map "[o]" $out
