#!/bin/bash
# rerender.sh START_S END_S  -> deletes the old frames in [START,END) and renders them again into frames/
cd "$(dirname "$0")"
s=$1; e=$2
n0=$(python3 -c "print(round($s*30))"); n1=$(python3 -c "print(round($e*30))")
for ((n=n0; n<n1; n++)); do rm -f frames/f$(printf %05d $n).jpg; done
mkdir -p logs
node shoot.mjs --range frames $s $e 30 > logs/re_${s}_${e}.log 2>&1
echo "rerendered $s-$e: $(ls frames | awk -F'[f.]' -v a=$n0 -v b=$n1 '{n=$2+0} n>=a && n<b' | wc -l) / $((n1-n0)) frames"
