"""
One real fight laid over the Rust fight that stays with it longest, frame by frame, around the first frame where the
two part. For finding a rule the port has wrong: a real and a Rust fight are identical to the centimetre until the
dice differ, so a parting that is not a dice roll (a strafe that flips, a dodge) is a rule.

    python pipeline/tools/page-shots.py pipeline/rustfull/probe-frames.js pipeline/rustfull/data --json frames-frost.json --timeout 300
    pipeline/rustfull/target/release/rustfull.exe frames Brannoc Isolde --fights 40 --out pipeline/rustfull/data/rust-frames-frost.json
    python pipeline/rustfull/frames-compare.py pipeline/rustfull/data/frames-frost.json pipeline/rustfull/data/rust-frames-frost.json [real fight number]

Columns: seconds, the player's hero x z, the opponent x z, each one's cast root, each one's attack wind-up (1/0), each
one's status (1 slowed, 2 stunned, 4 rooted), each one's HP. `*` marks the first frame that differs by more than 2 cm.
"""
import json, sys
def load(p):
    d=json.load(open(p,encoding='utf-8')); F={f['n']:f for f in d['fights']}; R={}
    for r in d['rows']: R.setdefault(r[0],[]).append(r[1:])
    return F,R
(FA,RA),(FB,RB)=load(sys.argv[1]),load(sys.argv[2])
which=int(sys.argv[3]) if len(sys.argv)>3 else 0
ra=RA[which]; fa=FA[which]
# the Rust fight of the same pairing that stays with the real one longest
best=None
for n,f in FB.items():
    if (f['h'],f['f'])!=(fa['h'],fa['f']): continue
    rb=RB[n]; k=0
    while k<min(len(ra),len(rb)) and all(abs(ra[k][j]-rb[k][j])<0.02 for j in (1,2,3,4)): k+=1
    if best is None or k>best[0]: best=(k,n)
k,n=best; rb=RB[n]
print(f"real fight {which} ({fa['h']} player v {fa['f']}), closest Rust fight {n}: same to within 2 cm for {k} frames ({k/60:.2f} s)")
names="t hx hz ox oz hroot oroot hwind owind hst ost hhp ohp".split()
for i in range(max(0,k-6), min(len(ra),len(rb),k+14)):
    print(('* ' if i==k else '  ')+'real '+' '.join(f"{v:7.3f}" for v in ra[i])); print('  rust '+' '.join(f"{v:7.3f}" for v in rb[i]))
print('      '+' '.join(f"{x:>7}" for x in names))
