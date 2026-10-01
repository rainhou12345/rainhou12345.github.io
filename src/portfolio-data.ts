export const portfolio = {
  nav: ['Home', 'About', 'Experience', 'Projects', 'Skills', 'Music', 'Beyond Engineering', 'Contact'],
  profile: {
    name: 'Yufeng “Rain” Hou',
    title: 'UBC Engineering Student | Robotics and Automation',
    tagline: 'Connecting robotic hardware, simulation, data, and human creativity.',
    intro: 'Engineering student with experience in dexterous robotic hands, robotic arms, teleoperation, mechanical testing, technical analysis, and international business communication.',
    email: 'rainhou12345@gmail.com',
    location: 'Vancouver, British Columbia',
  },
  about: [
    'I’m an engineering student at the University of British Columbia interested in building robots from the hardware up and understanding what happens when mechanical design, control, simulation, and data meet the real world.',
    'At Linkerbot, I worked around dexterous robotic hands and arms, contributing to URDF and MuJoCo simulation, actuator and joint analysis, voltage-to-angle modeling, load and lifetime estimation, product improvement, and robotics integration.',
    'I also worked across engineering, research, customer, and business settings, translating technical work into simulations, specifications, presentations, and bilingual communication. Outside of work, I keep building, from my own 13-DOF quadruped robot to electromechanical projects involving CAD, embedded systems, and robotics simulation.',
  ],
  experience: {
    role: 'Robotics Engineering and Business Development Intern', company: 'Linkerbot', place: 'Beijing, China', date: 'Summer 2026',
    summary: 'Linkerbot specializes in multi-degree-of-freedom dexterous hands, 7-DoF robotic arms, teleoperation, and embodied robotic manipulation.',
    points: [
      'Analyzed dexterous robotic hands with up to 22 degrees of freedom and 7-DoF robotic arms, studying joint motion, actuation, load limits, mechanical failure, teleoperation, and human-to-robot motion mapping.',
      'Modeled the nonlinear relationship between input voltage and finger-joint angle using fitted curves, multi-voltage averages, approximately 50 data points, and uncertainty ranges; the resulting visualization was approved for an official website demonstration.',
      'Estimated hand lifetime at intermediate payloads from unloaded and maximum-load data, and produced a bilingual product-improvement study covering stability, actuation, capacity, thermal performance, mounting, and cooling.',
      'Reviewed URDF hand models and worked with MuJoCo simulation workflows, while supporting robotics integration discussions involving ROS, Isaac Sim, and Franka Robotics.',
      'Translated engineering work into technical specifications, reports, presentations, posters, and meeting material for engineers, researchers, customers, universities, and international partners in English and Mandarin.',
    ],
    spotlights: ['Voltage-to-angle modelling', 'Lifetime-versus-payload estimation', 'URDF + MuJoCo workflows', 'Dexterous-hand improvement analysis', 'International technical communication'],
  },
  education: [
    { school: 'University of British Columbia', credential: 'Bachelor of Applied Science in Engineering', date: 'Expected June 2029', details: 'Engineering design · Linear algebra · Differential equations · MATLAB · Engineering physics · Thermodynamics · Electromagnetics · C and C++' },
    { school: 'Elgin Park Secondary School', credential: 'Graduated 2025 · Grade 12 average: 96%', date: 'AP Calculus BC: 5 · AP Microeconomics: 4 · AP Macroeconomics: 4', details: 'Strong academic performance in calculus, chemistry, physics, English, and Chinese.' },
  ],
  projects: [
    { n: '01', title: '13-DOF Robotic Dog', status: 'Completed · Independent build', text: 'My primary independent robotics project: a physical quadruped combining mechanical design, custom 3D-printed parts, electronics, embedded control, sensors, gait programming, simulation, kinematics, and actuator/load analysis.' },
    { n: '02', title: 'Vision-Controlled Robotic Hand', status: 'Completed · Interactive simulation', text: 'Designed a custom 16-part robotic hand in CAD, exported the assembly as STL files, and built a real-time browser simulation that maps webcam hand tracking to animated mechanical joints.', details: ['Recognizes rock, paper, or scissors', 'Responds with the winning move', 'Animates mechanical joints between poses', 'Rotate and inspect all 16 custom parts'], href: '/robotic-hand/' },
    { n: '03', title: 'Automatic Retrieval System', status: 'Completed · Top 3 finish', text: 'On a six-person UBC engineering team, helped develop an autonomous servo-driven claw and retrieval mechanism through circuit design, ultrasonic sensing, mechanical prototyping, iterative testing, and technical communication.' },
    { n: '04', title: 'Accessible Seed-Planting Device', status: 'Completed', text: 'Designed an assistive seed planter for wheelchair users and people with limited shoulder mobility. Built Fusion 360 CAD, refined the concept around client requirements, and presented it through a professional engineering poster.' },
  ],
  skills: [
    { name: 'Programming', level: 'Working knowledge', items: ['C', 'C++', 'Python', 'MATLAB', 'Basic Java'] },
    { name: 'Robotics', level: 'Applied + familiar', items: ['Teleoperation', 'Motion mapping', 'URDF', 'MuJoCo familiarity', 'ROS familiarity', 'Isaac Sim familiarity', 'Servo control', 'Sensor integration', 'Hand + arm systems', 'Mechanical testing', 'Data visualization'] },
    { name: 'Mechanical & design', level: 'Applied', items: ['Fusion 360 CAD', 'Mechanical design', 'Rapid prototyping', 'Iterative design', 'Component testing', 'Load + lifetime analysis', 'Human-centred design'] },
    { name: 'Electronics', level: 'Applied fundamentals', items: ['Arduino', 'Servos', 'Ultrasonic sensors', 'Breadboard circuits', 'Embedded prototyping'] },
    { name: 'Analysis & communication', level: 'Applied', items: ['Nonlinear curve fitting', 'Experimental data', 'Uncertainty visualization', 'Microsoft Excel', 'Technical reports', 'Technical posters', 'Presentations', 'English–Mandarin', 'Meeting summaries'] },
  ],
  timeline: [
    ['2011—present', 'Skiing'], ['2022—present', 'Music production + creative work'], ['2022—present', 'Gym + strength training'], ['2025', 'Graduated from Elgin Park'], ['2025', 'Began engineering at UBC'], ['2025—26', 'First-year engineering projects'], ['Summer 2026', 'Robotics internship at Linkerbot'], ['Present', 'Dexterous robotics, simulation, automation + advanced manufacturing'],
  ],
  interests: ['Music Production', 'Skiing', 'Strength Training', 'Chess'],
}
