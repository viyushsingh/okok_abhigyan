let timeLeft = 25 * 60;
let timerId = null;

const timerDisplay = document.getElementById('timer');
const healthTip = document.getElementById('healthTip');

const tips = [
    "Time to stretch! Touch your toes.",
    "Hydration check! Drink some water.",
    "20-20-20 Rule: Look at something 20ft away for 20 seconds.",
    "Deep breath in... and out."
];

function updateTimer() {
    let minutes = Math.floor(timeLeft / 60);
    let seconds = timeLeft % 60;
    timerDisplay.innerHTML = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    if (timeLeft === 0) {
        clearInterval(timerId);
        healthTip.innerHTML = tips[Math.floor(Math.random() * tips.length)];
        alert("Session Complete!");
    } else {
        timeLeft--;
    }
}

document.getElementById('startBtn').onclick = () => {
    if (!timerId) timerId = setInterval(updateTimer, 1000);
};

document.getElementById('resetBtn').onclick = () => {
    clearInterval(timerId);
    timerId = null;
    timeLeft = 25 * 60;
    updateTimer();
};