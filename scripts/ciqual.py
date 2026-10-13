#!/usr/bin/env python3
"""Construit public/aliments.json à partir de la table Ciqual 2025 (ANSES, Licence Ouverte)
et, pour les valeurs manquantes, de la table CALNUT 2020 (ANSES, table sans valeur manquante prévue
pour calculer des apports).

Usage : python3 scripts/ciqual.py CIQUAL2025_FR.csv CALNUT.csv.1 public/aliments.json
Sources : https://ciqual.anses.fr/ (copies publiques : dépôt openfoodfacts-server, external-data/ciqual)
"Anses. 2025. Table de composition nutritionnelle des aliments Ciqual."
"Anses. 2020. Table de composition nutritionnelle Ciqual pour le calcul des apports nutritionnels CALNUT."
"""
import csv, json, re, sys

ciq_path, cal_path, out_path = sys.argv[1:4]
# clé courte : (colonne Ciqual, nom CALNUT)
KEYS = [
    ('kcal', 'Energie, Règlement UE N° 1169 2011 (kcal 100 g)', 'nrj_kcal'),
    ('p', 'Protéines, N x facteur de Jones (g 100 g)', 'proteines_g'),
    ('g', 'Glucides (g 100 g)', 'glucides_g'),
    ('su', 'Sucres (g 100 g)', 'sucres_g'),
    ('l', 'Lipides (g 100 g)', 'lipides_g'),
    ('ags', 'AG saturés (g 100 g)', 'ags_g'),
    ('fib', 'Fibres alimentaires (g 100 g)', 'fibres_g'),
    ('sel', 'Sel chlorure de sodium (g 100 g)', 'sel_g'),
    ('ca', 'Calcium (mg 100 g)', 'calcium_mg'),
    ('fe', 'Fer (mg 100 g)', 'fer_mg'),
    ('mg', 'Magnésium (mg 100 g)', 'magnesium_mg'),
    ('zn', 'Zinc (mg 100 g)', 'zinc_mg'),
    ('k', 'Potassium (mg 100 g)', 'potassium_mg'),
    ('io', 'Iode (µg 100 g)', 'iode_mcg'),
    ('se', 'Sélénium (µg 100 g)', 'selenium_mcg'),
    ('va', 'Activité vitaminique A, équivalents rétinol (µg 100 g)', None),
    ('vd', 'Vitamine D (µg 100 g)', 'vitamine_d_mcg'),
    ('vc', 'Vitamine C (mg 100 g)', 'vitamine_c_mg'),
    ('b9', 'Vitamine B9 ou Folates totaux, équivalents folates alimentaires, DFE (µg 100 g)', 'vitamine_b9_mcg'),
    ('b12', 'Vitamine B12 (µg 100 g)', 'vitamine_b12_mcg'),
    ('ala', 'AG 18:3 c9,c12,c15 (n-3), alpha-linolénique (g 100 g)', 'ag_18_3_a_lino_g'),
    ('epa', 'AG 20:5 5c,8c,11c,14c,17c (n-3) EPA (g 100 g)', 'ag_20_5_epa_g'),
    ('dha', 'AG 22:6 4c,7c,10c,13c,16c,19c (n-3) DHA (g 100 g)', 'ag_20_6_dha_g'),
]

def val(s):
    s = (s or '').strip().replace(',', '.')
    if s in ('', '-'): return None
    if s.lower() == 'traces': return 0.0
    m = re.match(r'^<\s*([0-9.]+)$', s)
    if m: return float(m.group(1)) / 2
    try: return float(s)
    except ValueError: return None

def r3(x):
    if x is None: return None
    if x == 0: return 0
    from math import log10, floor
    d = max(0, 2 - int(floor(log10(abs(x)))))
    v = round(x, d)
    return int(v) if v == int(v) else v

# CALNUT : format long, hypothèse médiane (MB)
cal = {}
with open(cal_path, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        v = val(row['MB'])
        if v is not None: cal.setdefault(row['ALIM_CODE'].strip(), {})[row['CONST_LABEL'].strip()] = v

rows = list(csv.reader(open(ciq_path, encoding='utf-8'), delimiter='\t'))
head = [h.replace('\n', ' ').replace('  ', ' ').strip() for h in rows[0]]
idx = {h: i for i, h in enumerate(head)}
for _, col, _c in KEYS: assert col in idx, col

foods, filled, missing = [], 0, 0
groups = []
for r in rows[1:]:
    code, name = r[idx['alim_code']].strip(), r[idx['alim_nom_fr']].strip()
    if not code or not name: continue
    grp = r[idx['alim_grp_nom_fr']].strip() or 'autres'
    if grp not in groups: groups.append(grp)
    c = cal.get(code, {})
    vals = []
    for key, col, ck in KEYS:
        v = val(r[idx[col]])
        if v is None:
            if ck and ck in c: v = c[ck]; filled += 1
            elif key == 'va' and ('retinol_mcg' in c or 'beta_carotene_mcg' in c):
                v = c.get('retinol_mcg', 0) + c.get('beta_carotene_mcg', 0) / 6; filled += 1
            else: missing += 1
        vals.append(r3(v))
    foods.append([int(code), name, groups.index(grp)] + vals)

out = {'v': 'Ciqual 2025 (ANSES) · valeurs manquantes complétées par CALNUT 2020', 'k': [k for k, _, _ in KEYS], 'grp': groups, 'f': foods}
with open(out_path, 'w', encoding='utf-8') as f: json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(len(foods), 'aliments ·', filled, 'valeurs complétées par CALNUT ·', missing, 'toujours manquantes')
