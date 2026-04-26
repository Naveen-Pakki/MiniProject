document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('expense-form');
    const titleInput = document.getElementById('title');
    const amountInput = document.getElementById('amount');
    const categoryInput = document.getElementById('category');
    const dateInput = document.getElementById('date');
    const monthPicker = document.getElementById('month-picker');
    const dateGroupContainer = document.getElementById('date-group-container');
    const monthGroupContainer = document.getElementById('month-group-container');
    const expenseList = document.getElementById('expense-list');

    // Summary Array Elements
    const currentMonthTotalDisplay = document.getElementById('current-month-total');
    const currentMonthLabel = document.getElementById('current-month-label');
    const prevMonthTotalDisplay = document.getElementById('prev-month-total');
    const predictedTotalDisplay = document.getElementById('predicted-total');
    const aiSuggestionsDisplay = document.getElementById('ai-suggestions');
    const ctx = document.getElementById('expense-chart');

    // State
    let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    let chartInstance = null;
    let activeMonthContext = new Date();
    let isInitialLoad = true;
    let newlyAddedId = null;
    let isDailyMode = true;

    // Predefined Vibrant & Modern Color Palette (Tailwind-inspired)
    const VIBRANT_PALETTE = [
        '#6366f1', // Indigo
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#3b82f6', // Blue
        '#ef4444', // Red
        '#8b5cf6', // Violet
        '#06b6d4', // Cyan
        '#f43f5e', // Rose
        '#f97316', // Orange
        '#14b8a6', // Teal
        '#ec4899', // Pink
        '#d946ef'  // Fuchsia
    ];

    // Elegant, Soft & Modern Color Palette Mapping
    const CATEGORIES = {
        'Food': { color: '#d710e5ff', cssClass: 'cat-food' },
        'Travel': { color: '#3b82f6', cssClass: 'cat-travel' },
        'Shopping': { color: '#f59e0b', cssClass: 'cat-shopping' },
        'Bills': { color: '#6366f1', cssClass: 'cat-bills' },
        'Health': { color: '#06b6d4', cssClass: 'cat-health' },
        'Entertainment': { color: '#8b5cf6', cssClass: 'cat-entertainment' },
        'Education': { color: '#f97316', cssClass: 'cat-education' },
        'Others': { color: '#94a3b8', cssClass: 'cat-others' }
    };

    /**
     * Consistently gets color and info for a category.
     * Uses predefined mapping if available, otherwise cycles through the vibrant palette.
     */
    function getCategoryInfo(categoryName) {
        if (CATEGORIES[categoryName]) return CATEGORIES[categoryName];

        // Dynamic assignment for unknown categories
        const hash = categoryName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const colorIndex = hash % VIBRANT_PALETTE.length;
        return {
            color: VIBRANT_PALETTE[colorIndex],
            cssClass: 'cat-dynamic'
        };
    }

    /**
     * Utility to brighten or darken a hex color.
     * @param {string} hex - Color hex
     * @param {number} amount - Positive to lighten, negative to darken.
     */
    function adjustColor(hex, amount) {
        // Handle potential alpha channel in hex
        const cleanHex = hex.slice(0, 7);
        let r = parseInt(cleanHex.substring(1, 3), 16);
        let g = parseInt(cleanHex.substring(3, 5), 16);
        let b = parseInt(cleanHex.substring(5, 7), 16);
        
        r = Math.min(255, Math.max(0, r + amount));
        g = Math.min(255, Math.max(0, g + amount));
        b = Math.min(255, Math.max(0, b + amount));
        
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // Formatter for Indian Currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getTodayString = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();
        if (mm < 10) mm = '0' + mm;
        if (dd < 10) dd = '0' + dd;
        return yyyy + '-' + mm + '-' + dd;
    };

    // Custom Chart.js Plugin for Center Text
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: function (chart) {
            if (chart.config.type !== 'doughnut' || chart.data.labels[0] === 'No Data') return;
            const { width, height, ctx } = chart;
            ctx.restore();

            const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            if (total <= 0) return;

            const text = formatCurrency(total);
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";

            ctx.font = "800 1.5rem Inter";
            ctx.fillStyle = document.body.classList.contains('dark-mode') ? "#f8fafc" : "#0f172a";
            ctx.fillText(text, width / 2, height / 2 + 5);

            ctx.font = "700 0.65rem Inter";
            ctx.fillStyle = document.body.classList.contains('dark-mode') ? "#94a3b8" : "#64748b";
            ctx.fillText(isDailyMode ? "DAY TOTAL" : "MONTH TOTAL", width / 2, height / 2 - 15);

            ctx.save();
        }
    };

    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggleBtn) themeToggleBtn.textContent = '☀️';
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
            if (chartInstance) chartInstance.update();
        });
    }

    function renderHistory() {
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;

        const panelTitle = document.querySelector('.history-panel h2');
        historyContainer.innerHTML = '';

        if (isDailyMode) {
            if (panelTitle) panelTitle.textContent = 'Day-wise History';

            let dayMap = {};
            expenses.forEach(item => {
                const expDateStr = new Date(item.date).toISOString().split('T')[0];
                if (!dayMap[expDateStr]) {
                    dayMap[expDateStr] = {
                        dateStr: expDateStr,
                        label: new Date(expDateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                        total: 0
                    };
                }
                dayMap[expDateStr].total += item.amount;
            });

            const todayStr = getTodayString();
            if (!dayMap[todayStr]) {
                dayMap[todayStr] = {
                    dateStr: todayStr,
                    label: new Date(todayStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                    total: 0
                };
            }

            const sortedDays = Object.values(dayMap).sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr));

            let highestTotal = 0;
            sortedDays.forEach(d => { if (d.total > highestTotal) highestTotal = d.total; });

            const activeDateStr = dateInput.value || todayStr;

            sortedDays.forEach((d, index) => {
                const div = document.createElement('div');
                div.className = 'month-card';

                if (isInitialLoad) {
                    div.style.animationDelay = `${index * 0.05}s`;
                } else {
                    div.style.animation = 'none';
                    div.style.opacity = '1';
                }

                const isActive = d.dateStr === activeDateStr;
                const isHighest = d.total === highestTotal && highestTotal > 0;

                if (isActive) {
                    div.classList.add('active');
                    setTimeout(() => {
                        div.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }, 100);
                }
                if (isHighest) div.classList.add('highest-month');

                const dateObj = new Date(d.dateStr);
                const dayPart = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const datePart = dateObj.getDate();

                div.innerHTML = `
                    <div class="day-label">${dayPart}</div>
                    <div class="date-val">${datePart}</div>
                    <div class="month-total">${formatCurrency(d.total)}</div>
                    ${isHighest ? '<div style="position:absolute; top:-8px; right:-8px; font-size:1.2rem;">🏆</div>' : ''}
                `;

                div.addEventListener('click', () => {
                    dateInput.value = d.dateStr;
                    renderHistory();
                    renderExpenses();
                    updateSummary();
                });

                historyContainer.appendChild(div);
            });

        } else {
            if (panelTitle) panelTitle.textContent = 'Monthly History';

            let monthMap = {};
            expenses.forEach(item => {
                const expDate = new Date(item.date);
                const key = `${expDate.getFullYear()}-${expDate.getMonth()}`;
                if (!monthMap[key]) {
                    monthMap[key] = {
                        year: expDate.getFullYear(),
                        month: expDate.getMonth(),
                        label: expDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                        total: 0
                    };
                }
                monthMap[key].total += item.amount;
            });

            const currentNow = new Date();
            const currentKey = `${currentNow.getFullYear()}-${currentNow.getMonth()}`;
            if (!monthMap[currentKey]) {
                monthMap[currentKey] = {
                    year: currentNow.getFullYear(),
                    month: currentNow.getMonth(),
                    label: currentNow.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                    total: 0
                };
            }

            const sortedMonths = Object.values(monthMap).sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            });

            const activeYear = activeMonthContext.getFullYear();
            const activeMonth = activeMonthContext.getMonth();

            let highestTotal = 0;
            sortedMonths.forEach(m => { if (m.total > highestTotal) highestTotal = m.total; });

            sortedMonths.forEach((m, index) => {
                const div = document.createElement('div');
                div.className = 'month-card';

                if (isInitialLoad) {
                    div.style.animationDelay = `${index * 0.05}s`;
                } else {
                    div.style.animation = 'none';
                    div.style.opacity = '1';
                }

                const isActive = m.year === activeYear && m.month === activeMonth;
                const isHighest = m.total === highestTotal && highestTotal > 0;

                if (isActive) div.classList.add('active');
                if (isHighest) div.classList.add('highest-month');

                const monthPart = m.label.split(' ')[0];
                const yearPart = m.year;

                div.innerHTML = `
                    <div class="day-label">${monthPart}</div>
                    <div class="date-val" style="font-size: 1.1rem;">${yearPart}</div>
                    <div class="month-total">${formatCurrency(m.total)}</div>
                    ${isHighest ? '<div style="position:absolute; top:-8px; right:-8px; font-size:1.2rem;">🏆</div>' : ''}
                `;

                div.addEventListener('click', () => {
                    activeMonthContext = new Date(m.year, m.month, 1);
                    renderHistory();
                    renderExpenses();
                    updateSummary();
                });

                historyContainer.appendChild(div);
            });
        }
    }

    // Initialize App
    function init() {
        dateInput.value = getTodayString();
        refreshDashboard();
        isInitialLoad = false;
    }

    const entryModeRadios = document.querySelectorAll('input[name="entryMode"]');

    const initialModeNode = document.querySelector('input[name="entryMode"]:checked');
    isDailyMode = initialModeNode ? initialModeNode.value === 'daily' : true;

    function applyEntryMode() {
        if (!isDailyMode) {
            if (dateGroupContainer) dateGroupContainer.style.display = 'none';
            if (monthGroupContainer) monthGroupContainer.style.display = 'block';
            dateInput.removeAttribute('required');
        } else {
            if (dateGroupContainer) dateGroupContainer.style.display = 'block';
            if (monthGroupContainer) monthGroupContainer.style.display = 'none';
            dateInput.setAttribute('required', 'true');
        }
    }

    applyEntryMode();

    function refreshDashboard() {
        if (monthPicker) {
            const y = activeMonthContext.getFullYear();
            const m = (activeMonthContext.getMonth() + 1).toString().padStart(2, '0');
            monthPicker.value = `${y}-${m}`;
        }
        renderHistory();
        renderExpenses();
        updateSummary();
    }

    entryModeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            isDailyMode = e.target.value === 'daily';
            applyEntryMode();
            if (isDailyMode && !dateInput.value) dateInput.value = getTodayString();
            refreshDashboard();
        });
    });

    dateInput.addEventListener('change', () => {
        if (isDailyMode) refreshDashboard();
    });

    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            const dailyRadio = document.getElementById('mode-daily');
            if (dailyRadio) {
                dailyRadio.checked = true;
                isDailyMode = true;
                applyEntryMode();
                dateInput.value = getTodayString();
                refreshDashboard();
            }
        });
    }

    if (monthPicker) {
        monthPicker.addEventListener('change', (e) => {
            if (e.target.value) {
                const [year, month] = e.target.value.split('-').map(Number);
                activeMonthContext = new Date(year, month - 1, 1);
                refreshDashboard();
            }
        });
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = titleInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const category = categoryInput.value;
        const entryModeToggleNode = document.querySelector('input[name="entryMode"]:checked');
        const entryMode = (entryModeToggleNode && entryModeToggleNode.value) ? entryModeToggleNode.value : 'daily';
        let dateVal = dateInput.value;

        if (entryMode === 'monthly') {
            const [y, m] = monthPicker.value.split('-');
            dateVal = `${y}-${m}-01`;
        }

        if (title && amount > 0 && category && dateVal) {
            const expense = {
                id: Date.now().toString(),
                title,
                amount,
                category,
                date: new Date(dateVal).toISOString()
            };

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Adding... ⏳';
            submitBtn.style.opacity = '0.7';
            submitBtn.disabled = true;

            setTimeout(() => {
                newlyAddedId = expense.id;
                expenses.push(expense);
                saveData();

                form.reset();
                dateInput.value = getTodayString();
                titleInput.focus();

                refreshDashboard();

                submitBtn.innerHTML = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
                newlyAddedId = null;
            }, 300);
        }
    });

    window.deleteExpense = (id) => {
        expenses = expenses.filter(expense => expense.id !== id);
        saveData();
        renderHistory();
        renderExpenses();
        updateSummary();
    };

    // Bind Clear All Data button
    const clearDataBtn = document.getElementById('clear-data-btn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data?')) {
                expenses = [];
                saveData();
                activeMonthContext = new Date();
                renderHistory();
                renderExpenses();
                updateSummary();
            }
        });
    }

    // Bind Download Report button
    const downloadReportBtn = document.getElementById('download-report-btn');
    if (downloadReportBtn) {
        downloadReportBtn.addEventListener('click', () => {
            if (expenses.length === 0) {
                alert('No data to export!');
                return;
            }

            const headers = ['Title', 'Amount (INR)', 'Category', 'Date'];
            const csvRows = [headers.join(',')];

            const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedExpenses.forEach(exp => {
                const dateStr = new Date(exp.date).toLocaleDateString('en-CA');
                const title = `"${exp.title.replace(/"/g, '""')}"`;
                const amount = exp.amount;
                const category = `"${exp.category}"`;

                csvRows.push([title, amount, category, dateStr].join(','));
            });

            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'expenses-report.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Bind Reset Month button
    const resetMonthBtn = document.getElementById('reset-month-btn');
    if (resetMonthBtn) {
        resetMonthBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset this month's data?")) {
                const currentYear = activeMonthContext.getFullYear();
                const currentMonth = activeMonthContext.getMonth();

                expenses = expenses.filter(expense => {
                    const expDate = new Date(expense.date);
                    return !(expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth);
                });

                saveData();
                renderHistory();
                renderExpenses();
                updateSummary();
            }
        });
    }

    function saveData() {
        localStorage.setItem('expenses', JSON.stringify(expenses));
    }

    function animatePanel(selector) {
        const panel = document.querySelector(selector);
        if (panel) {
            panel.classList.remove('dashboard-update');
            void panel.offsetWidth; // Trigger reflow
            panel.classList.add('dashboard-update');
        }
    }

    function renderExpenses() {
        animatePanel('.list-panel');
        expenseList.innerHTML = '';

        const currentYear = activeMonthContext.getFullYear();
        const currentMonth = activeMonthContext.getMonth();
        const selectedDateStr = dateInput.value;

        const filteredExpenses = expenses.filter(expense => {
            const expDate = new Date(expense.date);
            if (isDailyMode) {
                if (!selectedDateStr) return false;
                return expDate.toISOString().split('T')[0] === selectedDateStr;
            } else {
                return expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth;
            }
        });

        if (filteredExpenses.length === 0) {
            expenseList.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
                    <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-dark);">No expenses added yet</div>
                </div>
            `;
            return;
        }

        const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedExpenses.forEach((expense, index) => {
            const catInfo = getCategoryInfo(expense.category);
            const expDate = new Date(expense.date);
            const dateStr = expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const li = document.createElement('li');
            li.className = 'expense-item';

            if (isInitialLoad) {
                li.style.animationDelay = `${index * 0.05}s`;
            } else if (expense.id === newlyAddedId) {
                li.style.animationDelay = '0s';
            } else {
                li.style.animation = 'none';
                li.style.opacity = '1';
            }

            // Generate contrast-aware style for the tag to match chart perfectly
            const tagStyle = `background-color: ${catInfo.color}22; color: ${catInfo.color}; border: 1px solid ${catInfo.color}44;`;

            li.innerHTML = `
                <div class="expense-info">
                    <span class="expense-title">${escapeHTML(expense.title)} <span style="color: var(--text-muted); font-size: 0.75rem; font-weight: normal; margin-left: 0.5rem;">${dateStr}</span></span>
                    <span class="expense-category" style="${tagStyle}">${escapeHTML(expense.category)}</span>
                </div>
                <div class="expense-right">
                    <span class="expense-amount">${formatCurrency(expense.amount)}</span>
                    <button class="btn-delete" onclick="deleteExpense('${expense.id}')" title="Delete expense">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            `;
            expenseList.appendChild(li);
        });
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function updateSummary() {
        animatePanel('.summary-panel');
        animatePanel('.chart-panel');
        const now = activeMonthContext;
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const trueNow = new Date();
        const isCurrentRealMonth = (trueNow.getFullYear() === currentYear && trueNow.getMonth() === currentMonth);
        const currentDay = isCurrentRealMonth ? trueNow.getDate() : new Date(currentYear, currentMonth + 1, 0).getDate();

        let prevYear = currentYear;
        let prevMonth = currentMonth - 1;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }

        let currentPeriodTotal = 0;
        let prevPeriodTotal = 0;

        let currentCategoryData = {};
        let prevCategoryData = {};

        Object.keys(currentCategoryData).forEach(cat => {
            currentCategoryData[cat] = 0;
            prevCategoryData[cat] = 0;
        });

        const selectedDateStr = dateInput.value;
        const selectedDateObj = selectedDateStr ? new Date(selectedDateStr) : new Date();
        const prevSelectedDateObj = new Date(selectedDateObj);
        prevSelectedDateObj.setDate(prevSelectedDateObj.getDate() - 1);
        const prevSelectedDateStr = prevSelectedDateObj.toISOString().split('T')[0];

        expenses.forEach(item => {
            const expDate = new Date(item.date);
            const itemCat = item.category;

            if (!currentCategoryData.hasOwnProperty(itemCat)) {
                currentCategoryData[itemCat] = 0;
                prevCategoryData[itemCat] = 0;
            }

            if (isDailyMode) {
                const expDateStr = expDate.toISOString().split('T')[0];
                if (expDateStr === selectedDateStr) {
                    currentPeriodTotal += item.amount;
                    currentCategoryData[itemCat] += item.amount;
                } else if (expDateStr === prevSelectedDateStr) {
                    prevPeriodTotal += item.amount;
                    prevCategoryData[itemCat] += item.amount;
                }
            } else {
                if (expDate.getFullYear() === currentYear && expDate.getMonth() === currentMonth) {
                    currentPeriodTotal += item.amount;
                    currentCategoryData[itemCat] += item.amount;
                } else if (expDate.getFullYear() === prevYear && expDate.getMonth() === prevMonth) {
                    prevPeriodTotal += item.amount;
                    prevCategoryData[itemCat] += item.amount;
                }
            }
        });

        let highestCategory = '';
        let highestAmount = 0;
        Object.keys(currentCategoryData).forEach(cat => {
            if (currentCategoryData[cat] > highestAmount) {
                highestAmount = currentCategoryData[cat];
                highestCategory = cat;
            }
        });

        const prevPeriodLabel = document.getElementById('prev-period-label');
        const predictionLabel = document.getElementById('prediction-label');
        const summaryTitle = document.getElementById('summary-title');

        // Update UI Labels & Title
        if (isDailyMode) {
            const displayDateObj = selectedDateStr ? new Date(selectedDateStr) : new Date();
            if (summaryTitle) summaryTitle.textContent = 'Daily Overview';
            currentMonthLabel.textContent = displayDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            if (prevPeriodLabel) prevPeriodLabel.textContent = 'Previous Day';
            if (predictionLabel) predictionLabel.textContent = 'Daily Average';
        } else {
            if (summaryTitle) summaryTitle.textContent = 'Monthly Overview';
            currentMonthLabel.textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            if (prevPeriodLabel) prevPeriodLabel.textContent = 'Previous Month';
            if (predictionLabel) predictionLabel.textContent = 'Monthly Prediction';
        }

        currentMonthTotalDisplay.textContent = formatCurrency(currentPeriodTotal);
        prevMonthTotalDisplay.textContent = formatCurrency(prevPeriodTotal);

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        let prediction = 0;

        if (!isDailyMode) {
            if (currentDay > 0 && currentPeriodTotal > 0) {
                const dailyAvg = currentPeriodTotal / currentDay;
                prediction = dailyAvg * daysInMonth;
                predictedTotalDisplay.textContent = formatCurrency(prediction);
            } else {
                predictedTotalDisplay.textContent = '₹0';
            }
        } else {
            // Daily prediction (Show average daily spend for current month context)
            const monthExpenses = expenses.filter(e => {
                const d = new Date(e.date);
                return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
            });
            const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
            const avgDaily = currentDay > 0 ? monthTotal / currentDay : 0;
            predictedTotalDisplay.textContent = formatCurrency(avgDaily);
            prediction = avgDaily; // Pass average daily spend as the 'prediction' context for AI
        }

        updateChart(currentCategoryData);
        generateAISuggestions(currentPeriodTotal, prevPeriodTotal, prediction, currentCategoryData, prevCategoryData, highestCategory, highestAmount);
    }

    function updateChart(currentCategoryData) {
        if (!ctx) return;

        const activeLabels = [];
        const activeData = [];
        const activeColors = [];

        Object.keys(currentCategoryData).forEach(cat => {
            if (currentCategoryData[cat] > 0) {
                const catInfo = getCategoryInfo(cat);
                activeLabels.push(cat);
                activeData.push(currentCategoryData[cat]);
                activeColors.push(catInfo.color);
            }
        });

        const chartEmptyState = document.getElementById('chart-empty-state');

        // Proper Chart Reset: Destroy existing instance before new render
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }

        if (activeData.length === 0) {
            ctx.style.display = 'none';
            if (chartEmptyState) chartEmptyState.style.display = 'flex';
            return;
        }

        ctx.style.display = 'block';
        if (chartEmptyState) chartEmptyState.style.display = 'none';

        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: activeLabels,
                datasets: [{
                    data: activeData,
                    backgroundColor: activeColors.map(color => {
                        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
                        gradient.addColorStop(0, adjustColor(color, 15)); // Slightly lighter top
                        gradient.addColorStop(1, color); // Base color bottom
                        return gradient;
                    }),
                    hoverBackgroundColor: activeColors.map(color => adjustColor(color, 40)),
                    hoverBorderColor: '#fff',
                    hoverBorderWidth: 2,
                    borderWidth: 0,
                    hoverOffset: 18,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 10
                },
                animation: {
                    duration: 1200,
                    easing: 'easeOutCubic',
                    animateScale: true,
                    animateRotate: true
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: "'Inter', sans-serif",
                                size: 11
                            },
                            usePointStyle: true,
                            padding: 15,
                            color: '#64748b'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#0f172a',
                        bodyColor: '#334155',
                        borderColor: '#e2e8f0',
                        borderWidth: 1,
                        titleFont: { family: "'Inter', sans-serif", size: 13 },
                        bodyFont: { family: "'Inter', sans-serif", size: 14, weight: 'bold' },
                        padding: 12,
                        cornerRadius: 8,
                        boxPadding: 4,
                        callbacks: {
                            label: function (context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                if (context.parsed !== null) {
                                    label += formatCurrency(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                },
                cutout: '70%'
            },
            plugins: [centerTextPlugin]
        });
    }

    function generateAISuggestions(currentTotal, prevTotal, prediction, currentCat, prevCat, highestCat, highestAmount) {
        aiSuggestionsDisplay.innerHTML = '';

        if (currentTotal === 0 && prevTotal === 0) {
            aiSuggestionsDisplay.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 1rem 0;">Add expenses to receive custom AI insights.</div>';
            return;
        }

        const suggestions = [];

        if (isDailyMode) {
            // Daily Mode AI Insights with specific thresholds and priorities

            // PRIORITY 1: Warning (Spend Levels & Comparison vs Average)
            const dailyAvg = prediction; // In Daily mode, 'prediction' is passed as the month's daily average

            if (currentTotal > 1000) {
                suggestions.push({
                    type: 'danger',
                    icon: '🚨',
                    text: 'Overspending today'
                });
            } else if (currentTotal > 500) {
                suggestions.push({
                    type: 'warning',
                    icon: '⚠️',
                    text: 'High spending today'
                });
            }

            if (currentTotal > 1.5 * dailyAvg && dailyAvg > 0) {
                suggestions.push({
                    type: 'warning',
                    icon: '📈',
                    text: 'Spending higher than usual'
                });
            }

            // PRIORITY 2: Top Category
            if (highestCat && currentCat[highestCat] > 0) {
                suggestions.push({
                    type: 'warning',
                    icon: '📊',
                    text: `Top category today is ${highestCat}`
                });
            }

            // PRIORITY 3: Trends & Status
            if (currentTotal < dailyAvg && currentTotal > 0) {
                suggestions.push({
                    type: 'success',
                    icon: '⬇️',
                    text: 'You are improving compared to your average'
                });
            } else if (currentTotal > 0) {
                suggestions.push({
                    type: 'success',
                    icon: '💡',
                    text: `Today's spend: ${formatCurrency(currentTotal)}`
                });
            }

            if (suggestions.length === 0 && currentTotal === 0) {
                suggestions.push({
                    type: 'success',
                    icon: '✅',
                    text: 'No spending recorded today'
                });
            }
        } else {
            // Monthly Mode AI Insights
            const monthlyPrediction = prediction;

            if (currentTotal > 5000) {
                suggestions.push({
                    type: 'danger',
                    icon: '🚨',
                    text: 'Overspending this month'
                });
            }

            if (currentTotal > prevTotal && prevTotal > 0) {
                suggestions.push({
                    type: 'warning',
                    icon: '📈',
                    text: 'Your spending is higher than last month'
                });
            }

            if (currentTotal > 0) {
                for (const cat of Object.keys(currentCat)) {
                    if (currentCat[cat] > currentTotal * 0.5) {
                        suggestions.push({
                            type: 'warning',
                            icon: '⚠️',
                            text: `Too much on ${cat}`
                        });
                        break;
                    }
                }
            }

            if (monthlyPrediction > 0) {
                suggestions.push({
                    type: 'warning',
                    icon: '🔮',
                    text: `Monthly trend: ${formatCurrency(monthlyPrediction)} expected`
                });
            }

            if (suggestions.length === 0 && currentTotal > 0) {
                suggestions.push({
                    type: 'success',
                    icon: '✅',
                    text: 'Your spending is well balanced'
                });
            }
        }

        // Cap to exactly 3 priority insights for Daily and Monthly modes
        suggestions.slice(0, 3).forEach((suggestion, index) => {
            const div = document.createElement('div');
            div.className = `suggestion-card ${suggestion.type}`;

            if (isInitialLoad) {
                div.style.animationDelay = `${index * 0.15}s`;
            } else {
                div.style.animationDelay = '0s';
            }

            div.innerHTML = `
                <span style="font-size: 1.25rem;">${suggestion.icon}</span>
                <span>${suggestion.text}</span>
            `;
            aiSuggestionsDisplay.appendChild(div);
        });
    }

    init();
});
