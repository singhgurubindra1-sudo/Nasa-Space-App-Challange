// Guided-tour steps for each page. `target` is a CSS selector; if it is not on the page the tip
// is shown in the middle of the screen instead, so tours never break when the layout changes.
export const TOURS = {
  dashboard: {
    title: 'Live Space Explorer',
    steps: [
      { target: null, title: 'Welcome to the Live Space Explorer 🌌', text: 'This page is a real-time map of space. Everything you see is where it really is right now, using live NASA and satellite-tracking data.' },
      { target: '.ex-tabs', title: 'Pick a view', text: 'Jump between the Galaxy, Solar System, Earth orbit, Asteroids, the Moon and Mars. Each tab zooms to a different scale.' },
      { target: '.ex-stage', title: 'Tap anything that moves', text: 'Drag to rotate, pinch or scroll to zoom. Tap a planet, satellite or asteroid to open its information card.' },
      { target: '.ex-warp', title: 'Control time', text: 'Watch it LIVE, or speed time up to see orbits move. The badges tell you if data is live, computed or an estimate.' },
      { target: '.ex-list', title: 'Find things fast', text: 'Every object in this view is listed here too. Tap a name to fly straight to it.' },
      { target: '.launch', title: 'Your mission starts here 🚀', text: 'When you are ready, go to the Mission Dashboard to choose the Moon or Mars and start the 30-sol survival game.' },
      { target: '[data-tour="help"]', title: 'Need help later?', text: 'Tap ❔ any time to replay this tour on any page, or to contact Mission Support.' },
    ],
  },
  choose: {
    title: 'Mission Dashboard',
    steps: [
      { target: '.mission-control', title: 'The Solar System, today', text: 'The planets are where they really are today. Tap the Moon or Mars to fly there and see live numbers like distance and radio delay.' },
      { target: '.worlds', title: 'Choose your world', text: 'The Moon is close to home but has 14-day nights and more radiation. Mars has dust storms and is months from help.' },
      { target: '.difficulty-picker', title: 'Choose a difficulty', text: 'Cadet is gentle, Commander is tough. Live NASA uses this month’s real solar storms and the current Mars dust season to set the challenge.' },
      { target: '.target-card', title: 'Know your target', text: 'Real facts about your base: gravity, temperature, radiation and power. These numbers drive the game.' },
      { target: '.launch', title: 'Launch!', text: 'Ready? Launch the mission. Your goal: keep a crew of 4 alive for 30 sols.' },
    ],
  },
  briefing: {
    title: 'Morning briefing',
    steps: [
      { target: '.sol-banner', title: 'Mission clock', text: 'Shows which day (sol) of the 30-sol mission you are on. Each sol is one turn of the game.' },
      { target: '.base-stage', title: 'Your base in 3D', text: 'This is your real base. It changes with your choices: shielding grows, plants grow, alarms flash when something breaks.' },
      { target: '.nova', title: 'Meet Nova, your CAPCOM', text: 'Nova reads you the status and the space-weather forecast every morning. Forecasts warn you about storms before they hit.' },
      { target: '.eva-row', title: 'Go outside (optional)', text: 'Step out in first person to explore, scan rocks for science facts, drive the rover, and manage the greenhouse.' },
      { target: '.gauges', title: 'Supplies and crew', text: 'Oxygen, water, food, battery, health and morale. If any of these hit zero, the mission fails. Watch the radiation dose too!' },
      { target: '.btn.sticky', title: 'Plan your day', text: 'When you have read the briefing, plan how to use today’s power.' },
    ],
  },
  plan: {
    title: 'Planning the sol',
    steps: [
      { target: '.power-card', title: 'Your power budget', text: 'This is all the energy you have today: solar (and a reactor on the Moon) plus the battery. Unused power charges the battery.' },
      { target: '.sliders', title: 'Split the power', text: 'Life support keeps everyone breathing: always give it what it needs first. Then share the rest between food, shielding and science.' },
      { target: '.actions', title: 'Pick ONE action', text: 'Build shielding, repair, plant, explore or shelter. If Nova forecasts a particle storm, Shelter!' },
      { target: '.warnings', title: 'Warnings', text: 'Red warnings tell you about a risky plan before you commit to it.' },
      { target: '.row.sticky', title: 'Run the sol', text: 'Happy with your plan? Run the sol and see what happens.' },
    ],
  },
  event: {
    title: 'Event report',
    steps: [
      { target: '.event-card', title: 'Today’s event', text: 'Every event is based on a real NASA story, like Opportunity’s 2018 dust storm. Some days are calm.' },
      { target: '.why', title: 'Why does this happen?', text: 'Tap “Why?” to learn the real science behind the event, with a link to the NASA source.' },
      { target: '.btn.sticky', title: 'Night report', text: 'Next, see how your supplies changed overnight.' },
    ],
  },
  debrief: {
    title: 'Mission debrief',
    steps: [
      { target: null, title: 'Mission debrief', text: 'Here is how your mission went: stars earned, a chart of every sol, and the one decision that mattered most (the turning point).' },
    ],
  },
  support: {
    title: 'Help Center',
    steps: [
      { target: '.seg-tabs', title: 'Help Center', text: 'Raise a ticket for bugs or questions, or send feedback. No account needed: just leave your email if you would like a reply.' },
    ],
  },
};
