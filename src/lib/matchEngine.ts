import { FORMATION_SLOTS, type Position } from "./playerGenerator";

export interface EnginePlayer {
  id: string; first_name: string; last_name: string; position: Position;
  overall: number; pace: number; shooting: number; passing: number;
  defending: number; physical: number; morale: number; fatigue: number; form: number;
}

export interface EngineClub {
  id: string; name: string; formation: string;
  tactic_style: "offensif" | "defensif" | "possession" | "contre" | "balanced";
  mentality: number; players: EnginePlayer[]; startingIds?: string[];
}

export type MatchEventType = "kickoff" | "goal" | "chance" | "chance_missed" | "save" | "yellow" | "red" | "corner" | "free_kick" | "penalty" | "offside" | "injury" | "substitution" | "tactical_change" | "half_time" | "full_time";
export interface MatchEvent { minute: number; type: MatchEventType; team: "home" | "away"; playerName: string; secondaryPlayerName?: string; commentary: string; xg?: number; }
export interface TeamMatchStats { possession: number; shots: number; shotsOnTarget: number; xg: number; corners: number; fouls: number; offsides: number; yellowCards: number; redCards: number; passAccuracy: number; }
export interface TacticalReaction { minute: number; team: "home" | "away"; from: EngineClub["tactic_style"]; to: EngineClub["tactic_style"]; reason: string; formationFrom?: string; formationTo?: string; }
export interface MatchResult { homeScore: number; awayScore: number; homeStrength: number; awayStrength: number; events: MatchEvent[]; stats: { home: TeamMatchStats; away: TeamMatchStats }; tacticalReactions: TacticalReaction[]; weather: "sunny" | "rain" | "cold"; }

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const avg = (players: EnginePlayer[], key: keyof EnginePlayer) => players.length ? players.reduce((s, p) => s + Number(p[key] ?? 0), 0) / players.length : 50;
const playerName = (p?: EnginePlayer) => p ? `${p.first_name} ${p.last_name}` : "Joueur inconnu";
const effective = (p: EnginePlayer, minute = 0) => p.overall * clamp(1 - p.fatigue / 330 - minute / 650, .48, 1) * (.85 + p.morale / 333) * (.8 + p.form / 250);
const emptyStats = (): TeamMatchStats => ({ possession: 50, shots: 0, shotsOnTarget: 0, xg: 0, corners: 0, fouls: 0, offsides: 0, yellowCards: 0, redCards: 0, passAccuracy: 0 });

const MODIFIERS: Record<EngineClub["tactic_style"], { attack: number; defense: number; possession: number; tempo: number; discipline: number }> = {
  offensif: { attack: 1.17, defense: .89, possession: 1, tempo: 1.17, discipline: .93 },
  defensif: { attack: .83, defense: 1.18, possession: .9, tempo: .82, discipline: 1.08 },
  possession: { attack: 1.04, defense: 1.02, possession: 1.19, tempo: .94, discipline: 1.04 },
  contre: { attack: 1.06, defense: 1.06, possession: .86, tempo: 1.13, discipline: .98 },
  balanced: { attack: 1, defense: 1, possession: 1, tempo: 1, discipline: 1 },
};

function selectXI(club: EngineClub) {
  const selected = club.startingIds?.map(id => club.players.find(p => p.id === id)).filter(Boolean) as EnginePlayer[] | undefined;
  if (selected?.length === 11) return [...selected];
  const slots = FORMATION_SLOTS[club.formation] ?? FORMATION_SLOTS["4-3-3"];
  const pool = [...club.players]; const xi: EnginePlayer[] = [];
  for (const slot of slots) {
    const pick = pool.filter(p => p.position === slot).sort((a,b)=>effective(b)-effective(a))[0] ?? pool.sort((a,b)=>effective(b)-effective(a))[0];
    if (pick) { xi.push(pick); pool.splice(pool.indexOf(pick),1); }
  }
  return xi.slice(0,11);
}

function units(club: EngineClub, xi: EnginePlayer[], minute: number, style: EngineClub["tactic_style"]) {
  const attackers = xi.filter(p => ["BU","AG","AD","MOC"].includes(p.position));
  const mids = xi.filter(p => ["MC","MDC","MOC"].includes(p.position));
  const defenders = xi.filter(p => ["DC","DL","DR","GK"].includes(p.position));
  const mod = MODIFIERS[style]; const fatigue = avg(xi,"fatigue")/100; const decay = minute/90*(.08+fatigue*.09); const mentality=(club.mentality-50)/100;
  return {
    attack:(avg(attackers,"shooting")*.42+avg(mids,"passing")*.34+avg(xi,"pace")*.24)*mod.attack*(1+mentality*.2)*(1-decay),
    defense:(avg(defenders,"defending")*.55+avg(mids,"defending")*.23+avg(xi,"physical")*.22)*mod.defense*(1-mentality*.14)*(1-decay*.8),
    control:(avg(mids,"passing")*.55+avg(xi,"overall")*.25+avg(xi,"physical")*.2)*mod.possession*(1-decay*.65),
    attackers, mids, defenders, tempo:mod.tempo, discipline:mod.discipline
  };
}

function weighted(players: EnginePlayer[], key: "shooting"|"passing"|"defending"|"overall"|"pace") {
  if (!players.length) return undefined; const total=players.reduce((s,p)=>s+Math.max(1,Number(p[key])),0); let roll=Math.random()*total;
  for (const p of players) { roll-=Math.max(1,Number(p[key])); if (roll<=0) return p; } return players.at(-1);
}

function bestReplacement(bench: EnginePlayer[], outgoing: EnginePlayer, attacking: boolean) {
  const compatible = bench.filter(p => p.position === outgoing.position || (["MC","MDC","MOC"].includes(p.position) && ["MC","MDC","MOC"].includes(outgoing.position)) || (["BU","AG","AD"].includes(p.position) && ["BU","AG","AD"].includes(outgoing.position)));
  const pool = compatible.length ? compatible : bench;
  return [...pool].sort((a,b)=> (effective(b)+(attacking?b.shooting*.15:b.defending*.15))-(effective(a)+(attacking?a.shooting*.15:a.defending*.15)))[0];
}

export function simulateMatch(home: EngineClub, away: EngineClub, options: { weather?: "sunny"|"rain"|"cold"; neutralVenue?: boolean } = {}): MatchResult {
  const weather=options.weather??"sunny"; let homeXI=selectXI(home); let awayXI=selectXI(away);
  let homeBench=home.players.filter(p=>!homeXI.some(x=>x.id===p.id)).slice(0,9); let awayBench=away.players.filter(p=>!awayXI.some(x=>x.id===p.id)).slice(0,9);
  const events: MatchEvent[]=[{minute:1,type:"kickoff",team:"home",playerName:"",commentary:"Coup d’envoi de la rencontre."}]; const tacticalReactions:TacticalReaction[]=[]; const stats={home:emptyStats(),away:emptyStats()};
  let homeScore=0,awayScore=0,homePasses=0,awayPasses=0,homeCompleted=0,awayCompleted=0,homeControl=0,awayControl=0,homeSubs=0,awaySubs=0;
  let homeStyle=home.tactic_style,awayStyle=away.tactic_style,homeFormation=home.formation,awayFormation=away.formation;

  const react=(minute:number,team:"home"|"away")=>{
    const isHome=team==="home", scoreFor=isHome?homeScore:awayScore, scoreAgainst=isHome?awayScore:homeScore, own=isHome?stats.home:stats.away, opp=isHome?stats.away:stats.home;
    const current=isHome?homeStyle:awayStyle; let next=current; let reason=""; let nextFormation=isHome?homeFormation:awayFormation;
    if(minute>=58 && scoreFor<scoreAgainst){ next="offensif"; nextFormation=minute>=75?"4-2-3-1":"4-3-3"; reason="Le staff augmente le risque pour revenir au score."; }
    else if(minute>=72 && scoreFor>scoreAgainst){ next="defensif"; nextFormation="5-3-2"; reason="Le bloc se resserre pour protéger l’avantage."; }
    else if(minute>=55 && own.possession<42 && own.shots<=opp.shots){ next="possession"; nextFormation="4-3-3"; reason="L’équipe cherche davantage de contrôle au milieu."; }
    else if(minute>=65 && own.possession>58 && own.shots<opp.shots){ next="contre"; nextFormation="4-2-3-1"; reason="La possession manque de profondeur, le jeu devient plus vertical."; }
    const oldFormation=isHome?homeFormation:awayFormation;
    if(next!==current || nextFormation!==oldFormation){ if(isHome){homeStyle=next;homeFormation=nextFormation;}else{awayStyle=next;awayFormation=nextFormation;}
      tacticalReactions.push({minute,team,from:current,to:next,reason,formationFrom:oldFormation,formationTo:nextFormation});
      events.push({minute,type:"tactical_change",team,playerName:"Entraîneur",commentary:`${isHome?home.name:away.name} passe en ${nextFormation}, style ${next}. ${reason}`}); }
  };

  const substitute=(minute:number,team:"home"|"away")=>{
    const isHome=team==="home"; let xi=isHome?homeXI:awayXI, bench=isHome?homeBench:awayBench, count=isHome?homeSubs:awaySubs; if(count>=5||!bench.length)return;
    const scoreFor=isHome?homeScore:awayScore, scoreAgainst=isHome?awayScore:homeScore, attacking=scoreFor<=scoreAgainst;
    const candidates=[...xi].filter(p=>p.position!=="GK").sort((a,b)=>(effective(a,minute)-effective(b,minute)) || (b.fatigue-a.fatigue));
    const outgoing=candidates[0]; const incoming=bestReplacement(bench,outgoing,attacking); if(!incoming)return;
    xi=xi.map(p=>p.id===outgoing.id?incoming:p); bench=bench.filter(p=>p.id!==incoming.id); bench.push(outgoing);
    if(isHome){homeXI=xi;homeBench=bench;homeSubs++;}else{awayXI=xi;awayBench=bench;awaySubs++;}
    events.push({minute,type:"substitution",team,playerName:playerName(incoming),secondaryPlayerName:playerName(outgoing),commentary:`${playerName(incoming)} remplace ${playerName(outgoing)} pour apporter ${attacking?"plus de danger":"davantage de fraîcheur défensive"}.`});
  };

  for(let minute=1;minute<=90;minute++){
    if(minute===46)events.push({minute:45,type:"half_time",team:"home",playerName:"",commentary:`Mi-temps : ${home.name} ${homeScore}-${awayScore} ${away.name}.`});
    if([55,62,70,78,84].includes(minute)){react(minute,"home");react(minute,"away");}
    if([57,66,75,82].includes(minute)){substitute(minute,"home");substitute(minute,"away");}
    const hu=units(home,homeXI,minute,homeStyle), au=units(away,awayXI,minute,awayStyle), advantage=options.neutralVenue?1:1.055; homeControl+=hu.control*advantage; awayControl+=au.control;
    const homeBall=Math.random()<hu.control*advantage/Math.max(1,hu.control*advantage+au.control); const attack=homeBall?hu:au, defense=homeBall?au:hu, attackers=homeBall?homeXI:awayXI, defenders=homeBall?awayXI:homeXI;
    const teamStats=homeBall?stats.home:stats.away, oppStats=homeBall?stats.away:stats.home, team: "home"|"away"=homeBall?"home":"away", club=homeBall?home:away;
    const passes=3+Math.floor(Math.random()*5*MODIFIERS[homeBall?homeStyle:awayStyle].possession), accuracy=clamp((avg(attackers,"passing")+avg(attackers,"form")*.1-(weather==="rain"?5:0))/100,.55,.94), completed=Array.from({length:passes}).filter(()=>Math.random()<accuracy).length;
    if(homeBall){homePasses+=passes;homeCompleted+=completed;}else{awayPasses+=passes;awayCompleted+=completed;}
    if(Math.random()<.018*(2-attack.discipline)*(weather==="rain"?1.18:1)){oppStats.fouls++;const offender=weighted(defenders.filter(p=>p.position!=="GK"),"defending"),roll=Math.random();if(roll<.035){oppStats.redCards++;events.push({minute,type:"red",team:homeBall?"away":"home",playerName:playerName(offender),commentary:`${playerName(offender)} est expulsé.`});}else if(roll<.3){oppStats.yellowCards++;events.push({minute,type:"yellow",team:homeBall?"away":"home",playerName:playerName(offender),commentary:`Carton jaune pour ${playerName(offender)}.`});}}
    if(Math.random()>=clamp(attack.attack/Math.max(45,defense.defense)*.034*attack.tempo,.012,.095))continue;
    if(Math.random()<.08){teamStats.offsides++;const runner=weighted(attack.attackers,"pace");events.push({minute,type:"offside",team,playerName:playerName(runner),commentary:`${playerName(runner)} est signalé hors-jeu.`});continue;}
    const shooter=weighted(attack.attackers.length?attack.attackers:attackers,"shooting"),creator=weighted(attack.mids.length?attack.mids:attackers,"passing"),keeper=defenders.find(p=>p.position==="GK");
    const quality=clamp((Number(shooter?.shooting??55)*.48+Number(creator?.passing??55)*.18+attack.attack*.22-defense.defense*.18+Math.random()*25)/100,.04,.72), penalty=Math.random()<.025, xg=penalty?.76:clamp(quality*(.12+Math.random()*.35),.03,.62); teamStats.shots++;teamStats.xg+=xg;
    if(penalty)events.push({minute,type:"penalty",team,playerName:playerName(shooter),commentary:`Penalty accordé à ${club.name} !`,xg}); else if(Math.random()<.13){teamStats.corners++;events.push({minute,type:"corner",team,playerName:playerName(creator),commentary:`Corner obtenu par ${club.name}.`});}
    if(Math.random()>=clamp(.34+Number(shooter?.shooting??50)/220,.38,.78)){events.push({minute,type:"chance_missed",team,playerName:playerName(shooter),secondaryPlayerName:playerName(creator),commentary:`${playerName(shooter)} manque le cadre.`,xg});continue;}
    teamStats.shotsOnTarget++; const goalProb=penalty?.76:clamp(xg*1.45+Number(shooter?.shooting??50)/500-(Number(keeper?.overall??58)*.55+Number(keeper?.form??50)*.16)/520,.08,.68);
    if(Math.random()<goalProb){if(homeBall)homeScore++;else awayScore++;events.push({minute,type:"goal",team,playerName:playerName(shooter),secondaryPlayerName:playerName(creator),commentary:`BUT ! ${playerName(shooter)} conclut l’action de ${club.name}.`,xg});}else events.push({minute,type:"save",team:homeBall?"away":"home",playerName:playerName(keeper),secondaryPlayerName:playerName(shooter),commentary:`${playerName(keeper)} repousse la tentative.`,xg});
  }
  const total=homeControl+awayControl; stats.home.possession=Math.round(homeControl/total*100);stats.away.possession=100-stats.home.possession;stats.home.passAccuracy=Math.round(homeCompleted/Math.max(1,homePasses)*100);stats.away.passAccuracy=Math.round(awayCompleted/Math.max(1,awayPasses)*100);stats.home.xg=Number(stats.home.xg.toFixed(2));stats.away.xg=Number(stats.away.xg.toFixed(2));
  events.push({minute:90,type:"full_time",team:"home",playerName:"",commentary:`Score final : ${home.name} ${homeScore}-${awayScore} ${away.name}.`});events.sort((a,b)=>a.minute-b.minute);
  const hi=units(home,selectXI(home),0,home.tactic_style),ai=units(away,selectXI(away),0,away.tactic_style);
  return {homeScore,awayScore,homeStrength:Math.round(hi.attack+hi.defense),awayStrength:Math.round(ai.attack+ai.defense),events,stats,tacticalReactions,weather};
}
