#!/bin/bash
# Renders sections ONE AT A TIME with all 4 workers on the same section, in order.
# Each line: name start end needs(comma-separated ready flags) delete(yes/no)
cd "$(dirname "$0")"
W=4
SECTIONS="desert 11 18 desert no
montage_a 32 33 montage yes
montage_b 33.5 34 montage yes
northreach 18 25 water yes
heartland 0 11 water yes
carrier 44 62 carrier yes"
log() { echo "$(date +%T) $*" >> logs/queue.log; }
echo "$SECTIONS" | while read name s e needs del; do
  for f in ${needs//,/ }; do while [ ! -f ready/$f ]; do sleep 10; done; done
  n0=$(python3 -c "print(round($s*30))"); n1=$(python3 -c "print(round($e*30))")
  if [ "$del" = yes ]; then for ((n=n0; n<n1; n++)); do rm -f frames/f$(printf %05d $n).jpg; done; fi
  log "START $name ($s-$e s, frames $n0-$((n1-1))) with $W workers"
  len=$(( n1 - n0 )); chunk=$(( (len + W - 1) / W ))
  for ((w=0; w<W; w++)); do
    a=$(( n0 + w*chunk )); b=$(( a + chunk )); (( b > n1 )) && b=$n1; (( a >= b )) && continue
    node shoot.mjs --range frames $(python3 -c "print($a/30)") $(python3 -c "print($b/30)") 30 > logs/q_${name}_$w.log 2>&1 &
  done
  wait
  got=$(ls frames | awk -F'[f.]' -v a=$n0 -v b=$n1 '{n=$2+0} n>=a && n<b' | wc -l)
  log "DONE  $name: $got / $len frames"
  touch done_$name
done
log "QUEUE FINISHED"
