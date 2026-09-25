/* story.js — the campaign. Chapters unlock from game state and play as dialogue scenes.
   Speakers: narrator, pip (Repair Unit 7), wren (Wren Calloway's notebook), vale (Garrick Vale, Obsidian Dynamics). */
'use strict';
(function (NG) {
  NG.SPEAKERS = {
    narrator: { name: '' },
    pip:  { name: 'PIP', role: 'Repair Unit 7' },
    wren: { name: 'WREN CALLOWAY', role: 'from her notebook' },
    vale: { name: 'GARRICK VALE', role: 'Obsidian Dynamics' }
  };

  const tier = (s, t) => s.models.some(m => NG.MODEL_MAP[m.type].tier >= t);

  NG.STORY = [
    {
      id: 'prologue', title: 'The Keys', when: () => true,
      lines: [
        ['narrator', "The lawyer's envelope held three things: a ring of keys, the deed to a shuttered repair shop in Halden Falls, and a note in cramped pencil."],
        ['wren', "Kid — the garage is yours now. The rack in the back still runs. So does Pip, mostly. Whatever they offer you, don't sell to Obsidian. Pip knows the rest. — Aunt Wren"],
        ['narrator', 'The roll-up door groans open. Dust, cable, one server rack humming in the dark. Something small and orange blinks a single enormous eye at you.'],
        ['pip', 'OH! A person! Hello, person. I am PIP, Repair Unit 7. Wren said you would come. She said it would be sooner. She was always late about being early.'],
        ['pip', "We have one very small AI model named PICO, three hundred dollars, and a stack of overdue bills. Let me show you how Wren kept the lights on."]
      ]
    },
    {
      id: 'firstpay', title: 'First Paycheck', when: s => s.jobsDone >= 3,
      lines: [
        ['pip', 'Ding! A client paid for a blog post. Our first money in eleven months!'],
        ['pip', 'Wren used to say: "Small jobs keep the lights on. Big jobs change the town." I have never understood the second part. I am hoping you will.']
      ]
    },
    {
      id: 'notebook1', title: "Wren's Notebook, p.1", when: s => s.peakRep >= 50,
      lines: [
        ['narrator', 'Behind a loose panel in Bay 2 you find a greasy spiral notebook, its cover held on with electrical tape.'],
        ['wren', "Day 1. Everyone in this town needs help they can't pay for. Resumes. Menus. Tax letters. Websites for the bakery. The models can do all of it, cheap and local, and nobody's data leaves this garage."],
        ['wren', 'Day 40. Rebuilt Pip with a bigger eye. He will not stop staring at things.'],
        ['pip', 'It is a GOOD eye.']
      ]
    },
    {
      id: 'visitor', title: 'A Visitor', when: s => s.totalEarned >= 5000,
      lines: [
        ['narrator', 'A black car idles outside. A man in a charcoal suit steps over a puddle as if it owes him money.'],
        ['vale', "Garrick Vale, Obsidian Dynamics. We're consolidating compute across Halden Falls, and your aunt's garage sits on the best fiber line in the county."],
        ['vale', 'Two hundred thousand for the building, as-is. Cash, today. Think it over — just not for long.'],
        ['pip', 'Wren had a special word for him. I am not programmed to say it in front of guests.']
      ]
    },
    {
      id: 'crate', title: 'The Welded Crate', when: s => s.bays.filter(b => b.unlocked).length >= 4,
      lines: [
        ['narrator', 'Clearing out the fourth bay, you find a steel crate welded shut. Stenciled on the lid: PROJECT LANTERN — NOT UNTIL THE GARAGE IS READY.'],
        ['pip', 'She welded it herself. I held the torch. Nobody told me why. That glowing machine in the middle of the garage started humming the moment you touched the crate. I think that is the LANTERN core.']
      ]
    },
    {
      id: 'notebook2', title: "Wren's Notebook, p.2", when: s => tier(s, 3),
      lines: [
        ['wren', "Obsidian wants models you rent forever. Meter every question, own every answer. I worked there six years. I built half of what they sell."],
        ['wren', "LANTERN is the other half. A model small enough to run on a library computer and good enough to actually matter. Free. Forever. Owned by nobody."],
        ['wren', 'Training it will take more compute than any one garage has ever held. So the garage will have to grow.']
      ]
    },
    {
      id: 'pressure', title: 'Pressure', when: s => s.peakRep >= 1000,
      lines: [
        ['narrator', "The power bill doubles overnight. Last week, Obsidian Dynamics bought the Halden Falls utility co-op."],
        ['vale', "Still running your little shop? Electricity isn't cheap anymore. My offer is down to one-fifty. It only moves in one direction."],
        ['pip', 'I have run the numbers. We should make so much money that his numbers stop mattering. I like this plan. It has no downsides that I can compute.']
      ]
    },
    {
      id: 'notebook3', title: "Wren's Notebook, p.3", when: s => tier(s, 4),
      lines: [
        ['wren', "If you're reading this, the garage finally has enough muscle to finish what I couldn't. Open the crate. The drives inside hold LANTERN's seed weights."],
        ['wren', 'Train it on the work this place has done. Every honest job, every late-night fix. That is the dataset. That is the whole point.'],
        ['pip', 'The crate is open. It contained forty hard drives and one extremely old sandwich. I have removed the sandwich. You are welcome.']
      ]
    },
    {
      id: 'finale', title: 'The Last Page', when: s => s.peakRep >= 10000,
      lines: [
        ['wren', 'Last page. When LANTERN runs, give it away. Every library, every school, every kitchen table in Halden Falls. Then the next town. Then the next.'],
        ['pip', 'PROJECT LANTERN is now on the contract board. It needs your best models, flawless quality, and a very long training run. I will make snacks. I cannot eat snacks, but I will make them.']
      ]
    },
    {
      id: 'ending', title: 'Lights On', when: s => s.won,
      lines: [
        ['narrator', 'At 3:12 a.m. the last training run finishes. Every fan in the garage spins down at once. Then every screen in the building shows the same two words: HELLO, HALDEN.'],
        ['narrator', "Before sunrise you publish LANTERN's weights on the public library's server. By noon, forty towns have mirrored it. By Friday, Obsidian Dynamics has had a very bad week."],
        ['vale', '...You gave it away. All of it. For free. ...I genuinely do not know what to say to that.'],
        ['pip', 'Wren would have laughed for an hour. Then she would have asked what we are building next.'],
        ['pip', 'So. Boss. What are we building next?']
      ]
    }
  ];
  NG.STORY_MAP = {};
  NG.STORY.forEach(c => { NG.STORY_MAP[c.id] = c; });

  // things Pip says when you click him, with a few that depend on progress
  NG.PIP_QUIPS = [
    'I am on break. My break is also work. I love it here.',
    'Did you know PICO once wrote a haiku about a toaster? It was not good.',
    'Beep. That was on purpose. Everything I do is on purpose.',
    'The coffee machine and I are not speaking.',
    'Pro tip: a model on a contract that fits its skills works faster AND better.',
    'Pro tip: big models on tiny contracts burn money. Give them big jobs.',
    'Pro tip: server racks come before shiny new models. Compute is everything.',
    'Wren named me after the sound I made when I was first turned on.',
    'I have swept this floor 11,204 times. It is a good floor.',
    s => s.storySeen.indexOf('visitor') >= 0 ? 'If the man in the suit comes back, I will stare at him. With the GOOD eye.' : 'Someone keeps parking a black car across the street. Probably nothing.',
    s => s.storySeen.indexOf('crate') >= 0 ? 'The LANTERN core hums louder when the garage is busy. I think it likes us.' : 'There is a crate in Bay 4 that I am not allowed to talk about.'
  ];
})(window.NG);
