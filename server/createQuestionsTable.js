require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const defaultQuestions = [
  {
    test_name: 'Caffeine',
    subgene1_name: 'CYP1A2',
    subgene2_name: 'ADORA2A',
    subgene1_questions: JSON.stringify([
      {
        question: "After drinking tea or coffee, how long do you usually feel active or fresh?",
        example: "Morning tea before work.",
        options: [
          { text: "Less than 2 hours", score: 1 },
          { text: "Around 2–4 hours", score: 0 },
          { text: "More than 4 hours", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "At what time can you usually drink tea or coffee without affecting your sleep?",
        example: "Your normal daily routine.",
        options: [
          { text: "Even in the evening", score: 1 },
          { text: "Afternoon", score: 0 },
          { text: "Only in the morning", score: -1 }
        ],
        weightage: 15
      },
      {
        question: "How much tea or coffee do you need before you feel its effect?",
        example: "Your usual cup of tea or coffee.",
        options: [
          { text: "I need a lot before I notice the effect", score: 1 },
          { text: "A normal amount", score: 0 },
          { text: "Even a small amount affects me", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "If you drink tea or coffee several times in one day, what usually happens?",
        example: "Morning + afternoon + evening tea.",
        options: [
          { text: "The effects wear off between cups", score: 1 },
          { text: "I feel the effect a little throughout the day", score: 0 },
          { text: "I still feel the effects at night", score: -1 }
        ],
        weightage: 20
      },
      {
        question: "In one day, how many cups of tea or coffee can you comfortably drink?",
        example: "Count all tea and coffee you usually drink.",
        options: [
          { text: "Three or more cups", score: 1 },
          { text: "Around two cups", score: 0 },
          { text: "One cup or less", score: -1 }
        ],
        weightage: 15
      }
    ]),
    subgene2_questions: JSON.stringify([
      {
        question: "If you drink tea or coffee after 5 PM, what usually happens?",
        example: "Evening tea or coffee.",
        options: [
          { text: "My sleep is not affected", score: 1 },
          { text: "Sometimes it affects my sleep", score: 0 },
          { text: "It usually disturbs my sleep", score: -1 }
        ],
        weightage: 30
      },
      {
        question: "After drinking tea or coffee, how often do you feel shaky, restless or notice a fast heartbeat?",
        example: "About 30 minutes after drinking.",
        options: [
          { text: "Rarely", score: 1 },
          { text: "Sometimes", score: 0 },
          { text: "Often", score: -1 }
        ],
        weightage: 20
      },
      {
        question: "Does even a small cup of tea or half a cup of coffee affect you?",
        example: "A small cup at home.",
        options: [
          { text: "No, I hardly notice any effect", score: 1 },
          { text: "Sometimes", score: 0 },
          { text: "Yes, even a small amount affects me", score: -1 }
        ],
        weightage: 10
      },
      {
        question: "After drinking tea or coffee, how do you usually feel?",
        example: "During work or study.",
        options: [
          { text: "Slightly fresh and active", score: 1 },
          { text: "Moderately active", score: 0 },
          { text: "Too active, restless or overexcited", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "Even if you sleep after drinking tea or coffee, how do you usually feel the next morning?",
        example: "The morning after having tea or coffee in the evening.",
        options: [
          { text: "Fresh and well rested", score: 1 },
          { text: "Okay", score: 0 },
          { text: "Tired or not fully rested", score: -1 }
        ],
        weightage: 15
      }
    ])
  },
  {
    test_name: 'Muscle',
    subgene1_name: 'ACTN3',
    subgene2_name: 'ACE',
    subgene1_questions: JSON.stringify([
      {
        question: "During short bursts of intense effort, how does your body usually feel?",
        example: "Running to catch a bus, climbing stairs quickly or lifting something heavy.",
        options: [
          { text: "Strong and powerful", score: 1 },
          { text: "Moderately capable", score: 0 },
          { text: "I get tired quickly or feel less powerful", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "Which type of physical activity suits your body better?",
        example: "Sports, gym or physically demanding work.",
        options: [
          { text: "Short and intense activities (under 1 minute)", score: 1 },
          { text: "Both short and long activities equally", score: 0 },
          { text: "Long and steady activities (over 20 minutes)", score: -1 }
        ],
        weightage: 20
      },
      {
        question: "After heavy work or exercise, how quickly does your body recover?",
        example: "Gym workout, sports or lifting heavy objects.",
        options: [
          { text: "Quickly, with very little soreness", score: 1 },
          { text: "Normally, with manageable soreness", score: 0 },
          { text: "Slowly, with prolonged soreness", score: -1 }
        ],
        weightage: 15
      },
      {
        question: "When you exercise regularly, how easily do you build muscle or gain strength?",
        example: "Push-ups, gym workouts or strength training.",
        options: [
          { text: "Easily or quickly", score: 1 },
          { text: "Moderately", score: 0 },
          { text: "Very slowly, even after regular training", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "When you lift or push something very heavy, how much force can you produce?",
        example: "Pushing a bike, lifting a heavy suitcase or moving furniture.",
        options: [
          { text: "A strong burst of force", score: 1 },
          { text: "A moderate amount of force", score: 0 },
          { text: "Very little force", score: -1 }
        ],
        weightage: 15
      }
    ]),
    subgene2_questions: JSON.stringify([
      {
        question: "If you walk fast, jog or cycle for more than 20 minutes, how does your body usually feel?",
        example: "Morning walk, jogging or cycling.",
        options: [
          { text: "I can continue comfortably", score: 1 },
          { text: "I get tired gradually", score: 0 },
          { text: "I get tired quickly", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "When your physical activity gradually increases over a few weeks, how does your body adjust?",
        example: "Increasing your daily walking distance or workout time.",
        options: [
          { text: "My body adapts very well", score: 1 },
          { text: "My body adjusts after some time", score: 0 },
          { text: "My body adjusts slowly and needs gradual increases", score: -1 }
        ],
        weightage: 15
      },
      {
        question: "During a long walk or bike ride, how long can you keep going before you feel tired?",
        example: "A one-hour walk or cycling trip.",
        options: [
          { text: "For a long time", score: 1 },
          { text: "For some time", score: 0 },
          { text: "I get tired quickly", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "After climbing stairs or running, how quickly does your breathing become normal?",
        example: "Climbing 2-3 floors or running for a short distance.",
        options: [
          { text: "Quickly", score: 1 },
          { text: "Normally", score: 0 },
          { text: "Slowly", score: -1 }
        ],
        weightage: 20
      },
      {
        question: "How is your stamina during everyday physical activities?",
        example: "Carrying groceries, walking long distances or doing household work.",
        options: [
          { text: "Very good, I rarely get tired", score: 1 },
          { text: "Okay", score: 0 },
          { text: "I get tired easily", score: -1 }
        ],
        weightage: 15
      }
    ])
  },
  {
    test_name: 'Hair',
    subgene1_name: 'EDAR',
    subgene2_name: 'FGFR2',
    subgene1_questions: JSON.stringify([
      {
        question: "Without any hair treatment, how would you describe your natural hair?",
        example: "Air-dried hair without using heat, styling products or chemical treatments.",
        options: [
          { text: "Mostly straight", score: 1 },
          { text: "Slightly wavy", score: 0 },
          { text: "Curly or tightly wavy", score: -1 }
        ],
        weightage: 20
      },
      {
        question: "One day after washing your hair, how does your scalp usually feel?",
        example: "Think about your scalp within 24 hours after washing.",
        options: [
          { text: "Oily", score: 1 },
          { text: "Normal or balanced", score: 0 },
          { text: "Dry, tight or flaky", score: -1 }
        ],
        weightage: 15
      },
      {
        question: "In hot weather or during exercise, how much do you usually sweat?",
        example: "Summer weather, brisk walking or playing sports.",
        options: [
          { text: "I sweat a lot", score: 1 },
          { text: "I sweat an average amount", score: 0 },
          { text: "I sweat very little", score: -1 }
        ],
        weightage: 15
      },
      {
        question: "How thick and full does your hair look?",
        example: "Looking at your hair in a mirror without styling.",
        options: [
          { text: "Thick and full, with very little scalp visible", score: 1 },
          { text: "Average", score: 0 },
          { text: "Thin, with scalp easily visible", score: -1 }
        ],
        weightage: 30
      },
      {
        question: "When you touch one strand of your hair, how does it feel?",
        example: "Hold one strand of clean, dry hair between your fingers.",
        options: [
          { text: "Thick and coarse", score: 1 },
          { text: "Medium", score: 0 },
          { text: "Thin and soft", score: -1 }
        ],
        weightage: 20
      }
    ]),
    subgene2_questions: JSON.stringify([
      {
        question: "How would you describe your natural hair thickness?",
        example: "Without styling products or hair treatments.",
        options: [
          { text: "Thick and dense", score: 1 },
          { text: "Average", score: 0 },
          { text: "Thin or fine", score: -1 }
        ],
        weightage: 30
      },
      {
        question: "Since becoming an adult, how much have your hair thickness and texture changed?",
        example: "Compare your hair now with when you were around 18–20 years old, excluding major medical or hormonal changes.",
        options: [
          { text: "Almost no change", score: 1 },
          { text: "Small gradual changes", score: 0 },
          { text: "Noticeable or major changes", score: -1 }
        ],
        weightage: 15
      },
      {
        question: "How does one strand of your hair feel?",
        example: "Hold a single strand of clean, dry hair between your fingers.",
        options: [
          { text: "Thick or wiry", score: 1 },
          { text: "Medium", score: 0 },
          { text: "Thin or fine", score: -1 }
        ],
        weightage: 25
      },
      {
        question: "How does your hair usually grow?",
        example: "Think about how quickly it grows after a haircut.",
        options: [
          { text: "It grows quickly and can become quite long", score: 1 },
          { text: "Average growth", score: 0 },
          { text: "It grows slowly or does not grow very long", score: -1 }
        ],
        weightage: 15
      },
      {
        question: "How often does your hair break or develop split ends?",
        example: "While combing, brushing or during your normal hair care routine.",
        options: [
          { text: "Rarely", score: 1 },
          { text: "Sometimes", score: 0 },
          { text: "Often", score: -1 }
        ],
        weightage: 15
      }
    ])
  }
];

async function createAndSeedTable() {
  try {
    console.log('Connecting to database...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_questions (
        id SERIAL PRIMARY KEY,
        test_name VARCHAR(255) UNIQUE NOT NULL,
        subgene1_name VARCHAR(255),
        subgene2_name VARCHAR(255),
        subgene1_questions JSONB,
        subgene2_questions JSONB,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ test_questions table created successfully!');

    const res = await pool.query('SELECT COUNT(*) FROM test_questions');
    if (parseInt(res.rows[0].count) === 0) {
      console.log('Seeding initial questions...');
      for (const q of defaultQuestions) {
        await pool.query(
          `INSERT INTO test_questions (test_name, subgene1_name, subgene2_name, subgene1_questions, subgene2_questions)
           VALUES ($1, $2, $3, $4, $5)`,
          [q.test_name, q.subgene1_name, q.subgene2_name, q.subgene1_questions, q.subgene2_questions]
        );
      }
      console.log('✅ Default questions seeded!');
    } else {
      console.log('Questions table already has data, skipping seed.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

createAndSeedTable();
