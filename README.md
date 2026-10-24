# usage-line

Claude Code modas, kuris apatinėje eilutėje po įvedimo laukeliu rodo spalvotą naudojimo suvestinę:
modelį, tikrąjį sesijos effort lygį, konteksto užpildymą, 5 valandų ir 7 dienų limitus su reset laikais.
Juostos žalios iki 50 %, geltonos iki 80 %, raudonos virš to, o jų ilgis prisitaiko prie terminalo pločio.

```
⏵⏵ auto mode on · Opus 5.5 medium ##------------ 11%  5h ####---------- 25% 06:40  7d ############-- 90% Sk 04:00
```

Pirmą kartą paleistas, modas iš vartotojo `settings.json` (`CLAUDE_CONFIG_DIR` arba `~/.claude`)
išima seną `statusLine` įrašą, kad eilutė nesidubliuotų.

## Įdiegimas

Claude Code terminale:

```
/plugin install usage-line --marketplace VytenisDulskis/claude-usage-line
```

Atsakyk `y` į „Add marketplace?“, tada Enter (user scope).

Iš komandinės eilutės:

```
claude plugin install usage-line --marketplace VytenisDulskis/claude-usage-line
```

Reikia naujos Claude Code versijos su modų (hooks modulių) palaikymu.
