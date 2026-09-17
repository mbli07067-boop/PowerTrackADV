/* =========================================================
   POWERTRACK - COMPLETE SCRIPT WITH INDEPENDENT SYSTEMS
   1. Muscle Mass System (multi-factor plan generator)
   2. Rank System (XP, Badges, Progression, Modal)
   3. 1v1 System (Arena, Challenges, Match History, Stat tracking)
========================================================= */

const getJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch (e) { return fallback; }
};

let profile = getJSON("powerTrackProfile", null);
let foods = getJSON("powerTrackFoods", []);
let weightHistory = getJSON("weightHistory", []);
let strengthHistory = getJSON("strengthHistory", []);
let targets = getJSON("nutritionTargets", null);
let workoutPlan = getJSON("workoutPlan", null);

let competitive = getJSON("powerTrackCompetitive", {
  xp: 0,
  wins: 0,
  losses: 0,
  winStreak: 0,
  matchHistory: [],
  pendingChallenges: [
    { from: "Nova", to: "You", type: "Bench Press", status: "Pending", outgoing: false, created: new Date().toLocaleDateString() }
  ]
});

let weightChart, strengthChart;

const RANKS = [
  { name: "Bronze", icon: "🥉", minXP: 0 },
  { name: "Silver", icon: "🥈", minXP: 250 },
  { name: "Gold", icon: "🥇", minXP: 600 },
  { name: "Platinum", icon: "💎", minXP: 1100 },
  { name: "Diamond", icon: "💎", minXP: 1800 },
  { name: "Elite", icon: "🔥", minXP: 2800 },
  { name: "Master", icon: "👑", minXP: 4200 },
  { name: "Grand Master", icon: "⚡", minXP: 6000 },
  { name: "Legend", icon: "🐐", minXP: 8500 }
];

const DEMO_PLAYERS = [
  { id: "atlas", name: "Atlas", rank: "Diamond", xp: 2050, wins: 28, losses: 9 },
  { id: "nova", name: "Nova", rank: "Elite", xp: 3100, wins: 41, losses: 14 },
  { id: "titan", name: "Titan", rank: "Master", xp: 4700, wins: 53, losses: 17 },
  { id: "iron", name: "IronWolf", rank: "Platinum", xp: 1450, wins: 24, losses: 18 },
  { id: "ghost", name: "GhostLift", rank: "Gold", xp: 790, wins: 15, losses: 12 },
  { id: "rex", name: "Rex", rank: "Legend", xp: 9100, wins: 92, losses: 21 }
];

const onboarding = document.getElementById("onboarding");
const app = document.getElementById("app");
const trainingType = document.getElementById("trainingType");
const powerliftingInputs = document.getElementById("powerliftingInputs");

trainingType.addEventListener("change", () => {
  powerliftingInputs.classList.toggle("hidden", trainingType.value !== "powerlifting");
});

document.getElementById("trainingDays").addEventListener("change", (e) => {
  const n = Number(e.target.value);
  document.querySelectorAll(".days-grid input").forEach(x => x.checked = false);
});

document.getElementById("profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const selectedDays = Array.from(document.querySelectorAll(".days-grid input:checked")).map(input => input.value);
  const daysCount = Number(document.getElementById("trainingDays").value);
  if (selectedDays.length !== daysCount) {
    alert(`Please select exactly ${daysCount} training days.`);
    return;
  }

  const muscleMass = Number(document.getElementById("muscleMass").value);
  const muscleMassUnit = document.getElementById("muscleMassUnit").value;

  profile = {
    name: document.getElementById("name").value.trim(),
    age: Number(document.getElementById("age").value),
    gender: document.getElementById("gender").value,
    height: Number(document.getElementById("height").value),
    weight: Number(document.getElementById("weight").value),
    muscleMass,
    muscleMassUnit,
    level: document.getElementById("level").value,
    trainingType: document.getElementById("trainingType").value,
    bench: Number(document.getElementById("bench").value) || 0,
    squat: Number(document.getElementById("squat").value) || 0,
    deadlift: Number(document.getElementById("deadlift").value) || 0,
    trainingDays: selectedDays
  };

  targets = {
    calories: calculateCalories(),
    protein: Math.round(profile.weight * 2),
    carbs: Math.round(profile.weight * 3),
    fat: Math.round(profile.weight * 0.8)
  };

  workoutPlan = generateWorkoutPlan();
  saveAll();
  onboarding.classList.add("hidden");
  app.classList.remove("hidden");
  loadApp();
});

function calculateCalories() {
  let bmr = profile.gender === "male" 
    ? (10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5) 
    : (10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161);
  return Math.round(bmr * 1.55);
}

/* =========================================================
   1. MUSCLE MASS & MULTI-FACTOR WORKOUT GENERATOR
   Personalizes intensity, sets, and suggested weights using:
   - Weight, Height, Muscle Mass ratio
   - Training Level & Training Type
   - Max Lifts & Number of Days
========================================================= */
function muscleMassPercent() {
  if (!profile || !profile.muscleMass) return 0;
  if (profile.muscleMassUnit === "percent") {
    return Math.min(Math.max(profile.muscleMass, 1), 70);
  }
  return Math.min(Math.max((profile.muscleMass / profile.weight) * 100, 1), 70);
}

function computeMultiFactors() {
  const pct = muscleMassPercent();
  const baseline = profile.gender === "female" ? 30 : 40;
  const muscleFactor = Math.max(0.85, Math.min(1.15, 1 + (pct - baseline) / 100));
  const levelFactor = { beginner: 0.9, intermediate: 1.0, advanced: 1.08 }[profile.level] || 1.0;
  const daysFactor = Math.max(0.9, Math.min(1.1, profile.trainingDays.length / 4));
  return muscleFactor * levelFactor * daysFactor;
}

function personalizeExercise(ex) {
  const factor = computeMultiFactors();
  let sets = ex.sets;
  if (typeof sets === "number" && factor < 0.95) sets = Math.max(2, sets - 1);
  if (typeof sets === "number" && factor > 1.08 && ex.sets < 5) sets = Math.min(5, sets + 1);

  let rpe = ex.rpe || 8;
  if (factor < 0.93) rpe = Math.max(6.5, rpe - 0.5);
  else if (factor > 1.07) rpe = Math.min(9.5, rpe + 0.5);

  let weight = ex.weight;
  if (typeof weight === "number" && factor > 1.0) {
    weight = Math.round((weight * factor) / 2.5) * 2.5;
  }
  return { ...ex, sets, rpe, weight };
}

function personalizeWorkouts(workouts) {
  return workouts.map(w => ({
    ...w,
    exercises: w.exercises.map(personalizeExercise)
  }));
}

function generateWorkoutPlan() {
  return profile.trainingType === "powerlifting"
    ? generatePowerliftingPlan()
    : generateBodybuildingPlan();
}

function generatePowerliftingPlan() {
  const days = profile.trainingDays, plan = {};
  const benchWeight = Math.round(profile.bench * 0.8);
  const squatWeight = Math.round(profile.squat * 0.8);
  const deadliftWeight = Math.round(profile.deadlift * 0.8);

  const workouts = personalizeWorkouts([
    { title: "Squat Focus", exercises: [{ name: "Squat", sets: 5, reps: 5, weight: squatWeight, rpe: 7 }, { name: "Romanian Deadlift", sets: 3, reps: 8, weight: "Moderate", rpe: 7 }, { name: "Leg Press", sets: 3, reps: 10, weight: "Moderate", rpe: 8 }, { name: "Core", sets: 3, reps: 15, weight: "Bodyweight", rpe: 7 }] },
    { title: "Bench Focus", exercises: [{ name: "Bench Press", sets: 5, reps: 5, weight: benchWeight, rpe: 7 }, { name: "Barbell Rows", sets: 4, reps: 8, weight: "Moderate", rpe: 8 }, { name: "Overhead Press", sets: 3, reps: 8, weight: "Moderate", rpe: 7 }, { name: "Triceps Pushdown", sets: 3, reps: 12, weight: "Moderate", rpe: 8 }] },
    { title: "Deadlift Focus", exercises: [{ name: "Deadlift", sets: 3, reps: 3, weight: deadliftWeight, rpe: 8 }, { name: "Lat Pulldown", sets: 4, reps: 10, weight: "Moderate", rpe: 8 }, { name: "Biceps Curls", sets: 3, reps: 12, weight: "Moderate", rpe: 8 }] },
    { title: "Upper Volume", exercises: [{ name: "Bench Press", sets: 4, reps: 8, weight: Math.round(profile.bench * 0.65), rpe: 7 }, { name: "Dumbbell Rows", sets: 4, reps: 10, weight: "Moderate", rpe: 8 }, { name: "Lateral Raises", sets: 3, reps: 12, weight: "Moderate", rpe: 8 }] },
    { title: "Lower Volume", exercises: [{ name: "Squat", sets: 4, reps: 8, weight: Math.round(profile.squat * 0.65), rpe: 7 }, { name: "Hamstring Curls", sets: 3, reps: 10, weight: "Moderate", rpe: 8 }, { name: "Leg Press", sets: 4, reps: 12, weight: "Moderate", rpe: 8 }] }
  ]);

  days.forEach((day, index) => plan[day] = workouts[index % workouts.length]);
  return plan;
}

function generateBodybuildingPlan() {
  const days = profile.trainingDays, plan = {};
  const workouts = personalizeWorkouts([
    { title: "Chest & Triceps", exercises: [{ name: "Bench Press", sets: 4, reps: "8-12", rpe: 8 }, { name: "Incline DB Press", sets: 3, reps: "10-12", rpe: 8 }, { name: "Cable Flyes", sets: 3, reps: "12-15", rpe: 9 }, { name: "Triceps Extensions", sets: 3, reps: "10-15", rpe: 8 }] },
    { title: "Back & Biceps", exercises: [{ name: "Lat Pulldowns", sets: 4, reps: "8-12", rpe: 8 }, { name: "Barbell Rows", sets: 4, reps: "8-10", rpe: 8 }, { name: "Seated Rows", sets: 3, reps: "10-12", rpe: 8 }, { name: "Biceps Curls", sets: 3, reps: "10-15", rpe: 9 }] },
    { title: "Leg Day Hypertrophy", exercises: [{ name: "Squats", sets: 4, reps: "6-10", rpe: 8 }, { name: "Leg Press", sets: 4, reps: "10-12", rpe: 9 }, { name: "Lying Leg Curls", sets: 3, reps: "10-15", rpe: 9 }, { name: "Calf Raises", sets: 4, reps: "12-20", rpe: 9 }] },
    { title: "Shoulders & Arms", exercises: [{ name: "Overhead DB Press", sets: 4, reps: "8-12", rpe: 8 }, { name: "Lateral Raises", sets: 4, reps: "12-20", rpe: 9 }, { name: "Hammer Curls", sets: 3, reps: "10-15", rpe: 9 }, { name: "Skullcrushers", sets: 3, reps: "10-15", rpe: 9 }] },
    { title: "Full Body Pump", exercises: [{ name: "Bench Press", sets: 3, reps: "8-10", rpe: 8 }, { name: "Lat Pulldown", sets: 3, reps: "10-12", rpe: 8 }, { name: "Leg Press", sets: 3, reps: "10-15", rpe: 8 }] }
  ]);

  days.forEach((day, index) => plan[day] = workouts[index % workouts.length]);
  return plan;
}

function loadApp() {
  document.getElementById("welcomeText").textContent = `Welcome, ${profile.name}`;
  renderDashboard();
  renderWorkout();
  renderFood();
  renderProfile();
  renderWeightChart();
  renderStrengthChart();
  renderRank();
  renderArena();
  renderLeaderboard();
}

function renderDashboard() {
  const totals = calculateFoodTotals();
  const currentWeight = weightHistory.length ? weightHistory[weightHistory.length - 1].weight : profile.weight;

  document.getElementById("currentWeight").textContent = currentWeight;
  document.getElementById("consumedCalories").textContent = totals.calories;
  document.getElementById("calorieTarget").textContent = targets.calories;
  document.getElementById("remainingCalories").textContent = Math.max(targets.calories - totals.calories, 0);

  document.getElementById("consumedProtein").textContent = totals.protein;
  document.getElementById("proteinTarget").textContent = targets.protein;
  document.getElementById("remainingProtein").textContent = Math.max(targets.protein - totals.protein, 0);

  document.getElementById("calorieProgress").style.width = Math.min((totals.calories / Math.max(targets.calories, 1)) * 100, 100) + "%";
  document.getElementById("proteinProgress").style.width = Math.min((totals.protein / Math.max(targets.protein, 1)) * 100, 100) + "%";

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long" });
  document.getElementById("todayWorkout").innerHTML = workoutPlan && workoutPlan[todayStr]
    ? `<strong>${escapeHTML(workoutPlan[todayStr].title)}</strong><p>${workoutPlan[todayStr].exercises.length} exercises scheduled</p>`
    : "No workout scheduled today 💪";

  const pct = muscleMassPercent();
  document.getElementById("dashboardMuscleInfo").innerHTML = `
    <div class="metric-row"><span>Muscle Mass</span><span class="metric-value">${profile.muscleMass} ${profile.muscleMassUnit === "percent" ? "%" : "kg"}</span></div>
    <div class="progress-bar muscle-meter"><div class="progress" style="width:${Math.min((pct / 60) * 100, 100)}%"></div></div>
    <p>${pct.toFixed(1)}% estimated muscle ratio used for load & volume adaptation.</p>
  `;

  const r = getCurrentRank();
  const next = getNextRank();
  document.getElementById("dashboardRankInfo").innerHTML = `
    <div class="metric-row"><span>${r.icon} ${r.name}</span><span class="metric-value">${competitive.xp} XP</span></div>
    <div class="progress-bar"><div class="progress" style="width:${rankProgressPercent()}%"></div></div>
    <p>${competitive.wins}W · ${competitive.losses}L · ${competitive.winStreak} Streak ${next ? `(Next: ${next.name})` : ""}</p>
  `;

  document.getElementById("headerRankMini").textContent = `${r.icon} ${r.name} · ${competitive.xp} XP`;
}

function renderWorkout() {
  const container = document.getElementById("workoutPlan");
  if (!workoutPlan) { container.innerHTML = ""; return; }

  const pct = muscleMassPercent();
  document.getElementById("workoutPersonalization").innerHTML = `
    <strong>Multi-Factor Program Active</strong>
    <p>Personalized from: Weight (${profile.weight}kg), Height (${profile.height}cm), Muscle Mass (${profile.muscleMass}${profile.muscleMassUnit === "percent" ? "%" : "kg"} / ~${pct.toFixed(1)}%), Level (${profile.level}), Type (${profile.trainingType}), ${profile.trainingDays.length} Days/wk.</p>
  `;

  container.innerHTML = Object.entries(workoutPlan).map(([day, workout]) => `
    <div class="workout-day">
      <h3><span>📅 ${day}</span><span class="pill">${workout.exercises.reduce((s, e) => s + (Number(e.sets) || 0), 0)} sets</span></h3>
      <h4>${escapeHTML(workout.title)}</h4>
      ${workout.exercises.map(e => `
        <div class="exercise">
          <h4>${escapeHTML(e.name)}</h4>
          <p><strong>Sets:</strong> ${e.sets} · <strong>Reps:</strong> ${e.reps}</p>
          <p><strong>Weight:</strong> ${typeof e.weight === "number" ? e.weight + " kg" : e.weight || "Self-selected"} · <strong>RPE:</strong> ${e.rpe}</p>
        </div>
      `).join("")}
    </div>
  `).join("");
}

document.getElementById("regenerateWorkout").addEventListener("click", () => {
  workoutPlan = generateWorkoutPlan();
  saveAll();
  renderWorkout();
  showToast("Workout plan regenerated!");
});

/* Nutrition Management */
document.getElementById("foodForm").addEventListener("submit", (event) => {
  event.preventDefault();
  foods.push({
    id: Date.now(),
    name: document.getElementById("foodName").value,
    meal: document.getElementById("mealType").value,
    calories: Number(document.getElementById("foodCalories").value),
    protein: Number(document.getElementById("foodProtein").value),
    carbs: Number(document.getElementById("foodCarbs").value),
    fat: Number(document.getElementById("foodFat").value),
    date: new Date().toLocaleDateString()
  });
  saveAll();
  renderFood();
  renderDashboard();
  event.target.reset();
});

function calculateFoodTotals() {
  const today = new Date().toLocaleDateString();
  return foods.filter(f => f.date === today).reduce((acc, f) => ({
    calories: acc.calories + (Number(f.calories) || 0),
    protein: acc.protein + (Number(f.protein) || 0),
    carbs: acc.carbs + (Number(f.carbs) || 0),
    fat: acc.fat + (Number(f.fat) || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function renderFood() {
  const t = calculateFoodTotals();
  document.getElementById("nutritionCalories").textContent = t.calories;
  document.getElementById("nutritionProtein").textContent = t.protein;
  document.getElementById("nutritionCarbs").textContent = t.carbs;
  document.getElementById("nutritionFat").textContent = t.fat;

  const today = new Date().toLocaleDateString();
  const list = foods.filter(f => f.date === today);
  document.getElementById("foodList").innerHTML = list.length
    ? list.map(f => `
      <div class="food-item">
        <div class="food-info">
          <strong>${escapeHTML(f.name)}</strong>
          <span>${escapeHTML(f.meal)} · ${f.calories} kcal · ${f.protein}g P</span>
        </div>
        <button class="delete-food" onclick="deleteFood(${f.id})">Delete</button>
      </div>
    `).join("")
    : "<p>No food added today.</p>";
}

function deleteFood(id) {
  foods = foods.filter(f => f.id !== id);
  saveAll();
  renderFood();
  renderDashboard();
}

/* Tracking & Charts */
document.getElementById("weightForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const weight = Number(document.getElementById("newWeight").value);
  weightHistory.push({ date: new Date().toLocaleDateString(), weight });
  localStorage.setItem("weightHistory", JSON.stringify(weightHistory));
  renderDashboard();
  renderWeightChart();
  event.target.reset();
});

function renderWeightChart() {
  const canvas = document.getElementById("weightChart");
  if (weightChart) weightChart.destroy();
  weightChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: weightHistory.map(x => x.date),
      datasets: [{
        label: "Weight (kg)",
        data: weightHistory.map(x => x.weight),
        borderColor: "#ffffff",
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        tension: 0.3
      }]
    },
    options: { responsive: true }
  });
}

document.getElementById("strengthForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (profile.trainingType !== "powerlifting") {
    alert("Strength tracking chart is tailored for Powerlifting maxes.");
    return;
  }
  const record = {
    date: new Date().toLocaleDateString(),
    bench: Number(document.getElementById("newBench").value) || profile.bench,
    squat: Number(document.getElementById("newSquat").value) || profile.squat,
    deadlift: Number(document.getElementById("newDeadlift").value) || profile.deadlift
  };
  strengthHistory.push(record);
  localStorage.setItem("strengthHistory", JSON.stringify(strengthHistory));
  renderStrengthChart();
  event.target.reset();
});

function renderStrengthChart() {
  const section = document.getElementById("strengthProgress");
  if (profile.trainingType !== "powerlifting") {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";
  const latest = strengthHistory.length ? strengthHistory[strengthHistory.length - 1] : { bench: profile.bench, squat: profile.squat, deadlift: profile.deadlift };
  document.getElementById("powerliftingTotal").textContent = (latest.bench || 0) + (latest.squat || 0) + (latest.deadlift || 0);

  const canvas = document.getElementById("strengthChart");
  if (strengthChart) strengthChart.destroy();
  strengthChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: strengthHistory.map(x => x.date),
      datasets: [
        { label: "Bench", data: strengthHistory.map(x => x.bench), borderColor: "#88c0ff" },
        { label: "Squat", data: strengthHistory.map(x => x.squat), borderColor: "#89ffb6" },
        { label: "Deadlift", data: strengthHistory.map(x => x.deadlift), borderColor: "#ff9d88" }
      ]
    },
    options: { responsive: true }
  });
}

function renderProfile() {
  const unit = profile.muscleMassUnit === "percent" ? "%" : "kg";
  document.getElementById("profileInfo").innerHTML = `
    <p><strong>Name:</strong> ${escapeHTML(profile.name)}</p>
    <p><strong>Age:</strong> ${profile.age}</p>
    <p><strong>Gender:</strong> ${escapeHTML(profile.gender)}</p>
    <p><strong>Height:</strong> ${profile.height} cm</p>
    <p><strong>Weight:</strong> ${profile.weight} kg</p>
    <p><strong>Muscle Mass:</strong> ${profile.muscleMass} ${unit}</p>
    <p><strong>Training Type:</strong> ${escapeHTML(profile.trainingType)}</p>
    <p><strong>Level:</strong> ${escapeHTML(profile.level)}</p>
    <p><strong>Days:</strong> ${profile.trainingDays.join(", ")}</p>
  `;

  document.getElementById("targetCalories").value = targets.calories;
  document.getElementById("targetProtein").value = targets.protein;
  document.getElementById("targetCarbs").value = targets.carbs;
  document.getElementById("targetFat").value = targets.fat;
}

document.getElementById("targetForm").addEventListener("submit", (event) => {
  event.preventDefault();
  targets = {
    calories: Number(document.getElementById("targetCalories").value),
    protein: Number(document.getElementById("targetProtein").value),
    carbs: Number(document.getElementById("targetCarbs").value),
    fat: Number(document.getElementById("targetFat").value)
  };
  localStorage.setItem("nutritionTargets", JSON.stringify(targets));
  renderDashboard();
  showToast("Targets saved successfully");
});

document.getElementById("editProfileBtn").addEventListener("click", () => {
  alert("To change profile inputs, use Reset and re-enter your details.");
});

/* =========================================================
   2. INDEPENDENT RANK SYSTEM
   ========================================================= */
function getCurrentRank() {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (competitive.xp >= r.minXP) current = r;
  }
  return current;
}

function getNextRank() {
  const idx = RANKS.findIndex(r => r.name === getCurrentRank().name);
  return RANKS[idx + 1] || null;
}

function rankProgressPercent() {
  const current = getCurrentRank();
  const next = getNextRank();
  if (!next) return 100;
  return Math.max(0, Math.min(100, ((competitive.xp - current.minXP) / (next.minXP - current.minXP)) * 100));
}

function addXP(amount, reason) {
  const beforeRank = getCurrentRank().name;
  competitive.xp += amount;
  saveCompetitive();
  const afterRank = getCurrentRank().name;

  if (afterRank !== beforeRank) {
    showRankUp(getCurrentRank(), amount);
  } else {
    showToast(`+${amount} XP · ${reason}`);
  }

  renderRank();
  renderDashboard();
  renderLeaderboard();
}

function renderRank() {
  const r = getCurrentRank();
  const next = getNextRank();

  document.getElementById("rankHero").innerHTML = `
    <div class="rank-hero">
      <div class="rank-hero-content">
        <div class="rank-badge large">${r.icon}</div>
        <div class="rank-name">${r.name}</div>
        <p class="xp-text">${competitive.xp} XP ${next ? `· ${next.minXP - competitive.xp} XP to ${next.name}` : "· Max Rank Achieved"}</p>
        <div class="rank-progress">
          <div class="progress-bar"><div class="progress" style="width:${rankProgressPercent()}%"></div></div>
        </div>
        <p style="margin-top:10px">${competitive.wins} Wins · ${competitive.losses} Losses · ${competitive.winStreak} Win Streak</p>
      </div>
    </div>
  `;

  document.getElementById("rankProgressPanel").innerHTML = `
    <div class="metric-row"><span>Current Rank</span><span class="metric-value">${r.icon} ${r.name}</span></div>
    <div class="metric-row"><span>Total XP</span><span class="metric-value">${competitive.xp}</span></div>
    <div class="progress-bar"><div class="progress" style="width:${rankProgressPercent()}%"></div></div>
    <p>${next ? `${competitive.xp - r.minXP} / ${next.minXP - r.minXP} XP in current tier` : "Top Rank Reached"}</p>
  `;

  document.getElementById("rankLadder").innerHTML = RANKS.map(x => `
    <div class="rank-ladder-item ${x.name === r.name ? "current" : ""}">
      <span class="rank-icon">${x.icon}</span>
      <div>
        <strong>${x.name}</strong>
        <div class="rank-xp">${x.minXP.toLocaleString()} XP</div>
      </div>
      <span>${x.name === r.name ? "YOU" : ""}</span>
    </div>
  `).join("");
}

function showRankUp(rank, amount) {
  document.getElementById("rankUpBadge").textContent = rank.icon;
  document.getElementById("rankUpName").textContent = rank.name;
  document.getElementById("rankUpText").textContent = `Congratulations! You reached ${rank.name}. (+${amount} XP earned)`;
  document.getElementById("rankUpModal").classList.remove("hidden");
}

document.getElementById("closeRankUp").addEventListener("click", () => {
  document.getElementById("rankUpModal").classList.add("hidden");
});

/* =========================================================
   3. INDEPENDENT 1v1 ARENA SYSTEM
   ========================================================= */
function currentTotal() {
  const latest = strengthHistory.length ? strengthHistory[strengthHistory.length - 1] : { bench: profile.bench, squat: profile.squat, deadlift: profile.deadlift };
  return (latest.bench || 0) + (latest.squat || 0) + (latest.deadlift || 0);
}

function getPlayerMetric(type) {
  const latest = strengthHistory.length ? strengthHistory[strengthHistory.length - 1] : { bench: profile.bench, squat: profile.squat, deadlift: profile.deadlift };
  if (type === "Total") return currentTotal();
  const map = { "Bench Press": "bench", "Squat": "squat", "Deadlift": "deadlift" };
  return latest[map[type]] || 0;
}

function winRate() {
  const total = competitive.wins + competitive.losses;
  return total ? Math.round((competitive.wins / total) * 100) : 0;
}

function renderArena() {
  document.getElementById("opponentSelect").innerHTML = DEMO_PLAYERS.map(p => `
    <option value="${p.id}">${p.name} · ${p.rank} (${p.wins}W/${p.losses}L)</option>
  `).join("");

  document.getElementById("arenaStats").innerHTML = `
    <div class="arena-stat"><div class="label">Wins</div><div class="value">${competitive.wins}</div></div>
    <div class="arena-stat"><div class="label">Losses</div><div class="value">${competitive.losses}</div></div>
    <div class="arena-stat"><div class="label">Win Rate</div><div class="value">${winRate()}%</div></div>
    <div class="arena-stat"><div class="label">Win Streak</div><div class="value">${competitive.winStreak}</div></div>
  `;

  document.getElementById("pendingChallenges").innerHTML = competitive.pendingChallenges.length
    ? competitive.pendingChallenges.map((c, i) => `
      <div class="challenge-row">
        <div>
          <strong>${c.outgoing ? "Sent to: " : "⚔️ Challenge from: "}${escapeHTML(c.outgoing ? c.to : c.from)}</strong>
          <p>Type: ${c.type} · Status: ${c.status}</p>
        </div>
        <div class="pending-actions">
          ${c.outgoing
            ? `<button class="danger-btn" onclick="rejectChallenge(${i})">Cancel</button>`
            : `<button class="secondary-btn" onclick="acceptChallenge(${i})">Accept</button>
               <button class="danger-btn" onclick="rejectChallenge(${i})">Reject</button>`}
        </div>
      </div>
    `).join("")
    : "<p>No pending challenges.</p>";

  document.getElementById("matchHistory").innerHTML = competitive.matchHistory.length
    ? competitive.matchHistory.slice().reverse().map(m => `
      <div class="history-row">
        <div>
          <strong>${m.result === "Win" ? "🏆 Victory" : "💀 Defeat"} vs ${escapeHTML(m.opponent)}</strong>
          <p>${m.type} · Score: ${m.myScore} vs ${m.opponentScore}</p>
        </div>
        <div>
          <span class="match-result ${m.result === "Win" ? "win" : "loss"}">${m.result === "Win" ? `+${m.xp} XP` : `+${m.xp} XP`}</span>
          <p style="font-size:11px">${m.date}</p>
        </div>
      </div>
    `).join("")
    : "<p>No matches yet. Send your first challenge above.</p>";
}

document.getElementById("challengeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.getElementById("opponentSelect").value;
  const type = document.getElementById("challengeType").value;
  const opp = DEMO_PLAYERS.find(x => x.id === id);

  competitive.pendingChallenges.push({
    from: profile.name,
    to: opp.name,
    type,
    status: "Sent",
    outgoing: true,
    created: new Date().toLocaleDateString()
  });

  saveCompetitive();
  renderArena();
  showToast(`Challenge sent to ${opp.name}`);
  event.target.reset();
});

function acceptChallenge(i) {
  const c = competitive.pendingChallenges[i];
  if (!c) return;
  competitive.pendingChallenges.splice(i, 1);
  simulateMatch(c.from, c.type);
}

function rejectChallenge(i) {
  competitive.pendingChallenges.splice(i, 1);
  saveCompetitive();
  renderArena();
  showToast("Challenge removed");
}

function simulateMatch(opponentName, type) {
  const myScore = getPlayerMetric(type);
  const oppData = DEMO_PLAYERS.find(p => p.name === opponentName);
  const baseOppScore = type === "Total"
    ? ({ Atlas: 420, Nova: 455, Titan: 510, IronWolf: 385, GhostLift: 340, Rex: 600 }[opponentName] || myScore)
    : Math.round(myScore * (0.85 + Math.random() * 0.3));

  const isWin = myScore >= baseOppScore;
  const xpGained = isWin ? 100 : 25;

  if (isWin) {
    competitive.wins += 1;
    competitive.winStreak += 1;
  } else {
    competitive.losses += 1;
    competitive.winStreak = 0;
  }

  competitive.matchHistory.push({
    opponent: opponentName,
    type,
    result: isWin ? "Win" : "Loss",
    myScore,
    opponentScore: baseOppScore,
    xp: xpGained,
    date: new Date().toLocaleDateString()
  });

  saveCompetitive();
  addXP(xpGained, isWin ? "1v1 Victory" : "1v1 Participation");
  renderArena();
}

/* =========================================================
   LEADERBOARD & NAVIGATION
   ========================================================= */
function renderLeaderboard() {
  const r = getCurrentRank();
  const me = {
    id: "me",
    name: profile.name,
    rank: r.name,
    xp: competitive.xp,
    wins: competitive.wins,
    losses: competitive.losses
  };

  const list = [...DEMO_PLAYERS, me].sort((a, b) => b.xp - a.xp);

  document.getElementById("leaderboardList").innerHTML = list.map((p, index) => `
    <div class="leader-row">
      <div class="leader-position">#${index + 1}</div>
      <div class="leader-main">
        <div class="leader-avatar">${p.id === "me" ? "⚡" : "🏋️"}</div>
        <div>
          <div class="leader-name">${escapeHTML(p.name)} ${p.id === "me" ? "(You)" : ""}</div>
          <div class="leader-meta">${getRankIcon(p.rank)} ${p.rank} · ${p.wins}W / ${p.losses}L</div>
        </div>
      </div>
      <div class="leader-score">
        <strong>${p.xp.toLocaleString()} XP</strong>
        <span>${p.wins + p.losses ? Math.round((p.wins / (p.wins + p.losses)) * 100) : 0}% WR</span>
      </div>
    </div>
  `).join("");
}

function getRankIcon(name) {
  const found = RANKS.find(r => r.name === name);
  return found ? found.icon : "🥉";
}

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(page).classList.add("active");
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    if (page === "rank") renderRank();
    if (page === "arena") renderArena();
    if (page === "leaderboard") renderLeaderboard();
  });
});

function saveCompetitive() {
  localStorage.setItem("powerTrackCompetitive", JSON.stringify(competitive));
}

function saveAll() {
  localStorage.setItem("powerTrackProfile", JSON.stringify(profile));
  localStorage.setItem("powerTrackFoods", JSON.stringify(foods));
  localStorage.setItem("weightHistory", JSON.stringify(weightHistory));
  localStorage.setItem("strengthHistory", JSON.stringify(strengthHistory));
  localStorage.setItem("nutritionTargets", JSON.stringify(targets));
  localStorage.setItem("workoutPlan", JSON.stringify(workoutPlan));
  saveCompetitive();
}

function showToast(text) {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[c]));
}

document.getElementById("resetApp").addEventListener("click", () => {
  if (!confirm("Are you sure? All stored data will be cleared.")) return;
  localStorage.clear();
  location.reload();
});

function initializeApp() {
  if (profile) {
    if (!profile.muscleMass) {
      profile.muscleMass = 0;
      profile.muscleMassUnit = "kg";
    }
    if (!targets) {
      targets = {
        calories: calculateCalories(),
        protein: Math.round(profile.weight * 2),
        carbs: Math.round(profile.weight * 3),
        fat: Math.round(profile.weight * 0.8)
      };
    }
    if (!workoutPlan) workoutPlan = generateWorkoutPlan();
    saveAll();
    onboarding.classList.add("hidden");
    app.classList.remove("hidden");
    loadApp();
  }
}

initializeApp();