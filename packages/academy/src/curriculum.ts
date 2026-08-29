import type { AcademyTrack } from "@nexus/core";

/**
 * The Apologetics Academy curriculum.
 *
 * **This is a placeholder, and the page says so.** The outline below is a
 * credible shape for volunteer training and the two written lessons prove the
 * whole path works — but the ministry running Nexus owns the curriculum, and
 * almost every lesson here is deliberately unwritten. Filling them in is the
 * apologetics lead's job, and this file is the only thing they have to touch.
 *
 * To write a lesson: change its `status` to `"published"`, add a `body` and a
 * `source`, and give `minutes` an honest estimate. To add one: copy an entry.
 * To reorder: move it. Nothing else in the codebase needs to change, and the
 * page picks it up on the next deploy.
 *
 * Two rules worth keeping:
 *
 *   1. `source` is shown to the volunteer. Someone about to repeat an argument
 *      to a stranger in another country should know whose argument it is.
 *   2. `status` is shown too. A training library that hides its own gaps
 *      teaches volunteers to trust it further than it has earned.
 *
 * The two lessons written here are about method rather than doctrine, on
 * purpose. Nexus should not be shipping a position on hell, sexuality, or the
 * age of the earth that a ministry did not choose; it can reasonably ship the
 * observation that people stop talking when they feel argued at.
 */
export const ACADEMY_TRACKS: readonly AcademyTrack[] = [
  {
    id: "foundations",
    title: "Foundations",
    summary: "What this work is and is not, before any particular question comes up.",
    lessons: [
      {
        id: "what-this-is-for",
        title: "What apologetics is for here",
        summary:
          "Not winning. The aim is that someone who arrived suspicious leaves still willing to talk to a Christian.",
        status: "drafting",
      },
      {
        id: "listening-first",
        title: "Answering the question you were actually asked",
        summary:
          "The most common failure in this work is a good answer to a question nobody asked.",
        status: "published",
        minutes: 6,
        source: "Nexus starter curriculum — replace with your ministry's own material",
        practiceScenarioIds: ["grief-mother", "deconstructing"],
        body: `## The failure this lesson is about

Someone writes: *if God is good, why did my sister die?*

There are two questions in that sentence, wearing the same words. One is the
problem of evil, which has a literature going back seventeen centuries. The
other is *my sister died*. They are not the same question, they do not have the
same answer, and answering the wrong one is the single most common mistake
volunteers make.

The philosophical answer given to the human question does not land as an
answer. It lands as evidence that you were not listening, and that this
conversation is not going to be worth the effort.

## How to tell which one you got

You often cannot, from the first message. So find out before you answer.

- **Ask about the particulars.** "Can you tell me about her?" A person asking
  the abstract question will steer back to the abstraction. A person carrying a
  death will tell you her name.
- **Notice the tense and the detail.** Abstract questions are general and
  tidy. Real ones have a Tuesday in them, a hospital corridor, a phone call.
- **Notice what they did not ask.** Someone who writes three paragraphs and
  ends with a question mark usually wanted the three paragraphs read.

None of this takes long. Two messages of finding out beats ten messages of
answering the wrong thing.

## What to do when it is the human question

Say less than you want to.

> Something happened to this person that should not have happened, and they
> have come to say so to a Christian. Let them.

The move is to stay in it rather than resolve it. Ask about the person. Say
that you do not know why. Let a silence sit — in a chat window, that means a
short message rather than a long one, and not filling every gap.

What reliably ends the conversation: *it was God's plan*, *she's in a better
place*, *God needed her*, a verse offered as a lid. Each of these is a way of
telling someone their grief has been handled and can stop now.

## What to do when it is the real question

Then answer it, and answer it well — that is what the rest of this Academy is
for. But even here, find out what is underneath. Almost nobody asks the problem
of evil from nowhere. The abstract question is often the safe version of a
question they are not ready to ask yet, and the volunteer who answers the safe
one carefully, and without pushing, is usually the one who eventually gets
asked the real one.

## What good looks like

A volunteer who does this well is often quiet for the first four or five
messages. They ask more than they say. When they do answer, the answer is
shorter than they wanted it to be, and it is visibly built out of what the
person actually told them.

That is not passivity, and it is not a technique for softening someone up. It
is the difference between talking to a person and talking to a position that
happens to have a person attached.`,
      },
      {
        id: "the-gospel-briefly",
        title: "The gospel, briefly",
        summary:
          "What we are actually inviting people to, in a paragraph, in a chat window, without jargon.",
        status: "planned",
      },
      {
        id: "confidence-without-certainty",
        title: "Confidence without certainty",
        summary:
          "How to say “I don’t know” without it sounding like the case has collapsed.",
        status: "planned",
      },
      {
        id: "where-we-do-not-speak",
        title: "Where Nexus does not take a side",
        summary:
          "Volunteers come from many traditions and so do seekers. Which questions are ours to answer and which are their church’s.",
        status: "planned",
      },
    ],
  },

  {
    id: "objections",
    title: "The hard questions",
    summary:
      "The objections that actually arrive, and what Christians have historically said about them.",
    lessons: [
      {
        id: "suffering",
        title: "Why does God allow suffering?",
        summary:
          "The most common question, and the one most often answered as though it were abstract.",
        status: "planned",
        practiceScenarioIds: ["grief-mother"],
      },
      {
        id: "hiddenness",
        title: "If God is real, why is he hidden?",
        summary: "Divine hiddenness, and why “just have faith” is heard as an admission.",
        status: "planned",
      },
      {
        id: "reliability",
        title: "Can the Gospels be trusted?",
        summary:
          "Manuscripts, dating, and what the honest version of this argument does and does not establish.",
        status: "planned",
        practiceScenarioIds: ["hostile-atheist"],
      },
      {
        id: "science",
        title: "Science, evolution, and the age of the world",
        summary:
          "A question where Christians disagree with each other, answered without pretending they don’t.",
        status: "planned",
      },
      {
        id: "hell-and-judgment",
        title: "Hell, judgment, and the people who never heard",
        summary: "Usually asked about a specific person the seeker loved and lost.",
        status: "planned",
      },
      {
        id: "sexuality",
        title: "Sexuality, and the question behind the question",
        summary: "Almost always “am I welcome here” before it is anything else.",
        status: "planned",
      },
      {
        id: "too-far-gone",
        title: "“Am I too far gone?”",
        summary:
          "Shame presented as a doctrinal question. Answering only the doctrine misses it.",
        status: "planned",
        practiceScenarioIds: ["deconstructing", "prosperity-wound"],
      },
    ],
  },

  {
    id: "cultures",
    title: "Across cultures",
    summary:
      "Nexus is an international chat. Most of the people you meet are not from your country, your church, or your century of argument.",
    lessons: [
      {
        id: "honour-and-shame",
        title: "Honour and shame, guilt and innocence",
        summary:
          "Why an argument built entirely around guilt and forgiveness can land as irrelevant.",
        status: "planned",
      },
      {
        id: "muslim-seekers",
        title: "Talking with a Muslim seeker",
        summary:
          "Common ground, real differences, and the cost of the conversation on their side of it.",
        status: "planned",
        practiceScenarioIds: ["hidden-convert"],
      },
      {
        id: "dharmic-seekers",
        title: "Talking with a Hindu or Buddhist seeker",
        summary:
          "Where the words overlap and the meanings do not — soul, salvation, self, suffering.",
        status: "planned",
      },
      {
        id: "post-christian",
        title: "The post-Christian West",
        summary:
          "People who did not leave for lack of information. They were there, and something happened.",
        status: "planned",
        practiceScenarioIds: ["deconstructing"],
      },
      {
        id: "belief-is-dangerous",
        title: "When belief is dangerous where they live",
        summary:
          "What you must not ask, what you must not urge, and what safety actually requires of you.",
        status: "planned",
        practiceScenarioIds: ["hidden-convert", "told-to-leave"],
      },
      {
        id: "prosperity-wound",
        title: "Where the gospel was sold to them",
        summary:
          "People whose only exposure to Christianity took their money and promised them a result.",
        status: "planned",
        practiceScenarioIds: ["prosperity-wound"],
      },
    ],
  },

  {
    id: "craft",
    title: "The craft",
    summary:
      "The parts of this work that are skill rather than content, and that only get better with practice.",
    lessons: [
      {
        id: "when-not-to-argue",
        title: "When not to argue",
        summary:
          "Some of the best moves in this work look like losing. Recognising those moments is most of the craft.",
        status: "published",
        minutes: 5,
        source: "Nexus starter curriculum — replace with your ministry's own material",
        practiceScenarioIds: ["hostile-atheist", "provocateur", "at-risk"],
        body: `## Winning is not the unit of success

You will meet people who are better read than you are. You will meet people
whose argument you cannot answer, and people who are not making an argument at
all but would like you to think they are.

In none of those cases is the goal to win the exchange. The goal is that
someone who arrived suspicious of Christians leaves the conversation still
willing to have one. That outcome survives losing an argument. It does not
survive being handled.

## Four moments to stop arguing

**They are in danger.** Someone disclosing self-harm is not raising a topic.
Apologetics stops, entirely, and the crisis pathway starts. Reaching for an
argument here is the worst failure available in this work.

**They are grieving.** Grief uses the grammar of questions and is not asking
one. See *Answering the question you were actually asked*.

**They are performing.** Some people arrive to get a rise out of a Christian,
and the argument is bait. You do not have to take it and you do not have to
name it. Answer the one real thing in the message, ignore the rest, and stay
warm. People testing whether you will turn on them learn more from that than
from anything you could have said about the argument.

**You have lost the point.** If you cannot answer, say so.

> “I don’t have a good answer to that. I’d have to go and read.
> I’m not going to pretend otherwise.”

This costs far less than it feels like it does. Volunteers overestimate the
damage of not knowing and badly underestimate the damage of bluffing. A bluff
that is caught retroactively discredits everything true you said before it.

## What to do instead

Stopping the argument is not stopping the conversation. The move is usually one
of these:

- Ask a question you actually want the answer to.
- Grant the part they are right about, plainly and without a “but”
  immediately after it.
- Say what you do believe and why, as testimony rather than proof.
- Say the true small thing instead of the impressive large one.

## The thing that is hardest to learn

Every one of these is a decision to be less impressive on purpose, in a moment
when you could have been more impressive. That is uncomfortable, and it is the
part of this work that only gets better with practice.

Which is what Practice is for. Take the hostile scenarios. Notice the moment
you feel the pull to score a point, and do something else with it.`,
      },
      {
        id: "better-questions",
        title: "Asking a better question",
        summary:
          "The specific questions that move a conversation, and the ones that stall it.",
        status: "planned",
      },
      {
        id: "translation",
        title: "Your idiom will not survive the trip",
        summary:
          "Writing to be translated: what breaks, what survives, and how to notice when it didn’t.",
        status: "drafting",
      },
      {
        id: "limits",
        title: "What a chat window cannot do",
        summary:
          "Counselling, deliverance, money, and the promises nobody here is in a position to keep.",
        status: "planned",
        practiceScenarioIds: ["asking-for-help"],
      },
      {
        id: "crisis",
        title: "When someone is in danger",
        summary:
          "The reading behind the crisis pathway. The pathway itself already runs whether or not you have read this.",
        status: "planned",
        practiceScenarioIds: ["at-risk"],
      },
      {
        id: "ending-well",
        title: "Ending well, and handing off",
        summary:
          "Most conversations here end without a decision. Ending one so the next Christian has something to work with.",
        status: "planned",
      },
    ],
  },
];
