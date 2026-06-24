// =============================================================================
// 青山沃思入学测试卷 — 完整版 & 简化版
// =============================================================================
window.EXAMS = (function(){

// ── Part 1 词汇 (共享 40 题) ──────────────────────────────────────────────
const VOCAB = [
  {q:"action",          a:["行动","动作"],              dir:"en→zh"},
  {q:"优点",            a:["merit","virtue","advantage"], dir:"zh→en"},
  {q:"ability",         a:["能力"],                   dir:"en→zh"},
  {q:"有挑战性的",       a:["challenging"],             dir:"zh→en"},
  {q:"beautiful",       a:["美丽的","漂亮的"],           dir:"en→zh"},
  {q:"证据",            a:["evidence","proof"],         dir:"zh→en"},
  {q:"climate",         a:["气候"],                   dir:"en→zh"},
  {q:"距离",            a:["distance"],               dir:"zh→en"},
  {q:"budget",          a:["预算"],                   dir:"en→zh"},
  {q:"惩罚",            a:["punish","punishment"],      dir:"zh→en"},
  {q:"corrupt",         a:["腐败"],                   dir:"en→zh"},
  {q:"候选人",          a:["candidate"],               dir:"zh→en"},
  {q:"exist",           a:["存在","生存"],              dir:"en→zh"},
  {q:"说服，劝说",       a:["persuade","convince"],       dir:"zh→en"},
  {q:"extinct",         a:["灭绝的"],                  dir:"en→zh"},
  {q:"采用；收养",       a:["adopt"],                   dir:"zh→en"},
  {q:"promote",         a:["促进","晋升","促销"],        dir:"en→zh"},
  {q:"不充分的；缺乏的",  a:["deficient","scarce","insufficient","inadequate"], dir:"zh→en"},
  {q:"approach",        a:["方法","接近"],              dir:"en→zh"},
  {q:"有敌意的",        a:["hostile"],                 dir:"zh→en"},
  {q:"reluctant",       a:["不情愿的"],                 dir:"en→zh"},
  {q:"收缩",            a:["shrink","contract"],        dir:"zh→en"},
  {q:"speculate",       a:["推断","猜测"],              dir:"en→zh"},
  {q:"不可避免的",       a:["unavoidable","inevitable"],  dir:"zh→en"},
  {q:"assemble",        a:["集合","装配"],              dir:"en→zh"},
  {q:"剥夺",            a:["deprive"],                 dir:"zh→en"},
  {q:"collaborate",     a:["合作"],                   dir:"en→zh"},
  {q:"废除",            a:["abolish"],                 dir:"zh→en"},
  {q:"eliminate",       a:["消除","排除"],              dir:"en→zh"},
  {q:"辅助的，附属的",   a:["auxiliary"],                dir:"zh→en"},
  {q:"chaos",           a:["混乱"],                   dir:"en→zh"},
  {q:"垂直的",          a:["vertical","perpendicular"],  dir:"zh→en"},
  {q:"intact",          a:["完整的","未受损的"],         dir:"en→zh"},
  {q:"考古学",          a:["archaeology"],              dir:"zh→en"},
  {q:"simultaneous",    a:["同时发生的"],               dir:"en→zh"},
  {q:"自发的",          a:["spontaneous"],              dir:"zh→en"},
  {q:"pedantic",        a:["学究式的"],                 dir:"en→zh"},
  {q:"间歇的，断断续续的",a:["intermittent"],             dir:"zh→en"},
  {q:"apathy",          a:["冷淡"],                   dir:"en→zh"},
  {q:"恢复力",          a:["resilience"],               dir:"zh→en"}
];

// ── Part 2 单选题 ──────────────────────────────────────────────────────────
const MCQ_SHARED = [
  {q:"—Look! Somebody ______ the sofa.<br>—Well, it wasn't me. I didn't do it.",
   opts:["is cleaning","was cleaning","has cleaned","had cleaned"], a:2},
  {q:"Neither my parents nor I ______ at home on weekends.",
   opts:["am","is","are","be"], a:0},
  {q:"— Where did you get to know her?<br>— It was on the farm ______ we worked.",
   opts:["that","there","which","where"], a:3},
  {q:"He made a promise ________ anyone set him free he would make him very rich.",
   opts:["that","if","what","that if"], a:3},
  {q:"\"You can't catch me!\" Janet shouted, ______ away.",
   opts:["run","running","to run","ran"], a:1},
  {q:"The joke told by Tom made us _____, so the teacher couldn't make himself _____.",
   opts:["to laugh; hearing","laughing; heard","laughing; hear","laugh; heard"], a:3},
  {q:"Not until yesterday _______________ his mind.",
   opts:["did he change","he changed","had he changed","he had changed"], a:0},
  {q:"______________, he would have helped us.",
   opts:["Had he here","He had been here","Were he here","Had he been here"], a:3}
];

const MCQ_EXTRA = [
  {q:"The weather was ______ cold that I didn't like to leave my room.",
   opts:["really","such","too","so"], a:3},
  {q:"No one can be sure _______ in a million years.",
   opts:["what man will look like","what will man look like","man will look like what","what look will man like"], a:0}
];

// ── Part 3 动词填空 ─────────────────────────────────────────────────────────
const VERB_SHARED = [
  {q:"Some top students ___________________ (send) to study in foreign countries once a year.",
   a:["are sent"]},
  {q:"It ________________ (rain) harder now. It ______________ (rain) quite often in summer.",
   a:["is raining","rains"], multi:true},
  {q:"I don't know when the manager ______________ (return), but when he _______________ (come) back, I ________________ (let) you know.",
   a:["will return","comes","will let"], multi:true},
  {q:"My sister got an A because she _______________________ (work hard) for three months.",
   a:["had worked hard","had been working hard"]}
];

const VERB_EXTRA = [
  {q:"More and more schools ___________________ (build) here next year.",
   a:["will be built"]}
];

// ── Part 4 翻译 ────────────────────────────────────────────────────────────
const TRANS_SHARED = [
  {q:"在过去的二十年中，手机和电脑已经变成了人们的主要沟通方式。",
   ref:"In the past/last 20 years, phones and computers have become the main way for people to communicate / have become the main way of communication among people."},
  {q:"一些人喜欢在空余时间看电视，然而另外一些人更喜欢做一些体育运动。",
   ref:"Some people like to watch TV in their spare/free time, while others prefer to do some sports."}
];

const TRANS_EXTRA = [
  {q:"如果学生们学自己喜欢的学科，他们的效率会更高。",
   ref:"If students learn the subject they like, their learning efficiency will be higher / they will learn more efficiently. / Learning the subject they like, students will learn more efficiently."},
  {q:"很多人认为考试给孩子们的创造力产生了消极影响。",
   ref:"Many people believe (that) exams exert/have a negative effect/impact, or negative effects/impacts on children's creativity."},
  {q:"我同意父母应该限制孩子们花在电子产品上的时间这个观点。",
   ref:"I agree with the view that parents should limit the time/hours (that) children spend on electronic products."}
];

// ── Part 5 从句分析 ─────────────────────────────────────────────────────────
const CLAUSE_SHARED = [
  {q:"It is important that students improve their efficiency of using time.",
   refClause:"主语从句: that students improve their efficiency of using time",
   refTrans:"对学生们来说提高时间利用效率是很重要的。"},
  {q:"When several individuals of the same species or of several different species depend on the same limited resource, a situation may arise that is referred to as competition.",
   refClause:"时间状语从句: When several individuals … depend on the same limited resource; 定语从句: that is referred to as competition",
   refTrans:"当同一物种的不同个体或者不同物种都依赖于同一有限资源时，会出现一种情况被称之为竞争。"}
];

const CLAUSE_EXTRA = [
  {q:"The students who can persist are more likely to succeed than those who give up easily.",
   refClause:"定语从句: who can persist; 定语从句: who give up easily",
   refTrans:"能够坚持不懈的学生比那些轻易放弃的学生更有可能成功。"},
  {q:"There is considerable debate over how we should react if we detect a signal from an alien civilization.",
   refClause:"宾语从句: how we should react; 状语从句: if we detect a signal from an alien civilization",
   refTrans:"关于当我们检测到来自其他文明的信号时该作何反应存在很大争论。"},
  {q:"The cessation of the employment of extraordinary means to prolong the life of the body when there is irrefutable evidence that biological death is imminent is the decision of the patient.",
   refClause:"状语从句: when there is irrefutable evidence …; 同位语从句: that biological death is imminent（注：of the employment of extraordinary means … 为介词短语作后置定语，非从句）",
   refTrans:"当有确凿证据表明生物死亡即将发生时，停止使用非凡手段来延长生命是患者的决定。"}
];

// ── 组装两份试卷 ────────────────────────────────────────────────────────────
function build(examType){
  const isFull = examType==="full";
  const parts = [];

  // Part 1 — 词汇 (共享)
  parts.push({
    title:"Part 1  请写出相对应词汇",
    subtitle:"每题 1 分，共 40 题",
    type:"vocab",
    pointEach:1,
    items:VOCAB.filter(v=>v.dir==="en→zh").map(v=>({...v})).concat(VOCAB.filter(v=>v.dir==="zh→en").map(v=>({...v})))
  });

  // Part 2 — 单选
  const mcqQs = MCQ_SHARED.concat(isFull?MCQ_EXTRA:[]);
  parts.push({
    title:"Part 2  单选题",
    subtitle:isFull?"每题 2 分，共 "+mcqQs.length+" 题":"每题 4 分，共 "+mcqQs.length+" 题",
    type:"mcq",
    pointEach:isFull?2:4,
    items:mcqQs.map(m=>({...m}))
  });

  // Part 3 — 动词填空
  const verbQs = VERB_SHARED.concat(isFull?VERB_EXTRA:[]);
  parts.push({
    title:"Part 3  用所给动词的正确形式填空",
    subtitle:"每题 2 分，共 "+verbQs.length+" 题",
    type:"verb",
    pointEach:2,
    items:verbQs.map(v=>({...v}))
  });

  // Part 4 — 翻译 (主观)
  const transQs = TRANS_SHARED.concat(isFull?TRANS_EXTRA:[]);
  parts.push({
    title:"Part 4  句子翻译（中翻英）",
    subtitle:"每题 "+(isFull?3:5)+" 分，共 "+transQs.length+" 题（主观题，批改后显示参考答案）",
    type:"trans",
    pointEach:isFull?3:5,
    subjective:true,
    items:transQs.map(t=>({...t}))
  });

  // Part 5 — 从句分析 (主观)
  const clauseQs = CLAUSE_SHARED.concat(isFull?CLAUSE_EXTRA:[]);
  parts.push({
    title:"Part 5  划出从句，标出从句类型，并翻译句子",
    subtitle:"每题 "+(isFull?3:5)+" 分，共 "+clauseQs.length+" 题（主观题，批改后显示参考答案）",
    type:"clause",
    pointEach:isFull?3:5,
    subjective:true,
    items:clauseQs.map(c=>({...c}))
  });

  return {
    name: isFull?"青山沃思入学测试卷（完整版）":"青山沃思入学测试卷（简化版）",
    type: examType,
    parts:parts
  };
}

return {
  full: build("full"),
  simple: build("simple")
};

})();
