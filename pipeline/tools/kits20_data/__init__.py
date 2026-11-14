"""The twenty new heroes' cards and kits (gate 1 and gate 3 on paper), as data.

`pipeline/tools/kits20.py` checks them (the answer arithmetic of docs/pipeline/new-hero.md rule 4 and the budgets of
pipeline/designs/kit-common.md) and writes pipeline/designs/kit-<theme>.md, docs/heroes/next20/index.html and
docs/heroes/kits20/index.html from them.

Spell fields: k (P Q W E R, or Q2/E2 for a second form), name, shape, cd, rng, size, dmg, rule, ans (the answer in words),
chk (the arithmetic: {'k': 'bolt', 'windup', 'speed'} | {'k': 'circle', 'warn', 'r'} | {'k': 'lane', 'warn', 'half'} |
{'k': 'react', 'warn', 'need'} | {'k': 'reach'} spacing, no reaction | {'k': 'none'}), land (first possible hit, s after the
cast), lasting (True: the effect outlives 4.2 s, so it is a trait mark read in victimTick, not a spell hit), knockup, pull,
heal, lock, units (caps), fx (the effect part by part), eng (what the engine needs), scr (the screen that decides it),
cpu (what the CPU does with it).
"""
from .p1 import HEROES as _a
from .p2 import HEROES as _b
from .p3 import HEROES as _c
from .p4 import HEROES as _d

HEROES = _a + _b + _c + _d
