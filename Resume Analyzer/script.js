document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const analyzeBtn = document.getElementById('analyze-btn');
    const fileUpload = document.getElementById('file-upload');
    const fileNameDisplay = document.getElementById('file-name');
    const jobRoleSelect = document.getElementById('job-role');
    
    const resultsSection = document.getElementById('results-section');
    const scoreProgress = document.getElementById('score-progress');
    const scoreNumber = document.getElementById('score-number');
    const scoreLabel = document.getElementById('score-label');
    const missingSkillsContainer = document.getElementById('missing-skills-container');
    const suggestionsList = document.getElementById('suggestions-list');

    const noMissingMsg = document.getElementById('no-missing-msg');
    const themeBtn = document.getElementById('theme-btn');
    const copyBtn = document.getElementById('copy-btn');
    const improvedResumeCard = document.getElementById('improved-resume-card');

    // Initially hide improved resume card
    if (improvedResumeCard) {
        improvedResumeCard.style.display = "none";
    }

    // State
    let resumeText = "";
    let originalResume = "";
    let boosted = false;
    let lastMissingSkills = [];

    // Constants
    const CIRCLE_CIRCUMFERENCE = 283; 
    
    // Role matching dictionaries (comprehensive required skills)
    const ROLE_SKILLS = {
        'frontend': ['html', 'css', 'javascript', 'react', 'vue', 'angular', 'typescript', 'next.js', 'sass', 'responsive design', 'api', 'git', 'jest', 'web accessibility', 'tailwind'],
        'java': ['java', 'spring', 'spring boot', 'rest', 'api', 'sql', 'hibernate', 'maven', 'docker', 'microservices', 'junit', 'kafka', 'kubernetes', 'gradle', 'cloud'],
        'python': ['python', 'django', 'flask', 'fastapi', 'sql', 'rest', 'api', 'pip', 'pytest', 'postgresql', 'redis', 'git', 'docker'],
        'data': ['python', 'sql', 'excel', 'power bi', 'tableau', 'machine learning', 'data analysis', 'pandas', 'numpy', 'statistics', 'r', 'pyspark', 'hadoop', 'scikit-learn'],
        'backend': ['node.js', 'python', 'java', 'sql', 'postgresql', 'redis', 'nosql', 'mongodb', 'aws', 'docker', 'rest', 'api', 'microservices', 'graphql', 'grpc', 'security'],
        'fullstack': ['javascript', 'typescript', 'react', 'next.js', 'node.js', 'mongodb', 'postgresql', 'sql', 'html', 'css', 'git', 'docker', 'api', 'aws', 'rest', 'testing'],
        'ml': ['python', 'machine learning', 'deep learning', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'statistics', 'nlp', 'computer vision', 'data visualization'],
        'devops': ['docker', 'kubernetes', 'aws', 'cicd', 'jenkins', 'terraform', 'ansible', 'linux', 'bash', 'git', 'monitoring', 'prometheus', 'grafana', 'yaml'],
        'software': ['c++', 'java', 'python', 'data structures', 'algorithms', 'sql', 'git', 'design patterns', 'software development', 'testing', 'agile', 'oop'],
        'android': ['kotlin', 'java', 'android studio', 'android sdk', 'jetpack compose', 'retrofit', 'mvvm', 'firebase', 'sqlite', 'material design', 'git']
    };

    // Copy Resume Clipboard Handling
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const textToCopy = document.getElementById('improvedResume').innerText;
            if (!textToCopy || textToCopy.includes("optimized resume will appear here")) {
                alert("Please analyze a resume first.");
                return;
            }

            try {
                await navigator.clipboard.writeText(textToCopy);
                const originalText = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span class="btn-icon">✅</span> Copied!';
                copyBtn.classList.add('success-state');
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalText;
                    copyBtn.classList.remove('success-state');
                }, 2000);
            } catch (err) {
                console.error("Failed to copy text: ", err);
                alert("Could not copy to clipboard. Please try again.");
            }
        });
    }

    // Toggle button attached during load
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Reset when role changes
    if (jobRoleSelect) {
        jobRoleSelect.addEventListener("change", function () {
            boosted = false;
            if (scoreNumber) scoreNumber.innerText = "0";
            // Reset progress circle too
            if (scoreProgress) scoreProgress.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
            updateScoreStyles(0);
            
            const boostBtn = Array.from(document.querySelectorAll('.primary-btn')).find(b => b.innerText.includes('Boost My Resume') || b.innerText.includes('Resume Boosted'));
            if (boostBtn) {
                boostBtn.innerText = "Boost My Resume 🚀";
                boostBtn.disabled = false;
            }

            if (improvedResumeCard) {
                improvedResumeCard.style.display = "none";
            }
        });
    }

    // File Upload Handler (PDF & DOCX)
    if (fileUpload) {
        fileUpload.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            fileNameDisplay.textContent = file.name;
            resumeText = "Reading file...";
            analyzeBtn.disabled = true;

            try {
                if (file.name.endsWith('.pdf')) {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = "";
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(item => item.str).join(" ") + "\n";
                    }
                    resumeText = fullText.trim();
                    originalResume = resumeText;
                } else if (file.name.endsWith('.docx')) {
                    const arrayBuffer = await file.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    resumeText = result.value.trim();
                    originalResume = resumeText;
                } else {
                    resumeText = "";
                    fileNameDisplay.textContent = "Unsupported file (Use PDF/DOCX)";
                }
            } catch (error) {
                console.error("Error reading file:", error);
                resumeText = "";
                fileNameDisplay.textContent = "Error parsing file.";
            }
            
            analyzeBtn.disabled = false;
            event.target.value = ''; // Allow re-upload
        });
    }

    // Analyze Event
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            if (!resumeText || resumeText === "Reading file...") {
                alert("Please upload a valid PDF or DOCX file first.");
                return;
            }

            const btnLoader = document.getElementById('btn-loader');
            const btnText = document.getElementById('btn-text');
            
            if (btnLoader) btnLoader.classList.remove('hidden');
            if (btnText) btnText.textContent = "Analyzing...";
            analyzeBtn.disabled = true;

            setTimeout(() => {
                performAnalysis();
                if (btnLoader) btnLoader.classList.add('hidden');
                if (btnText) btnText.textContent = "Analyze ATS Match";
                analyzeBtn.disabled = false;
            }, 1200);
        });
    }

    function performAnalysis() {
        const selectedRole = jobRoleSelect.value;
        const targetSkills = ROLE_SKILLS[selectedRole] || [];
        
        let score = 0;
        let suggestions = [];
        
        const normalizedText = " " + resumeText.toLowerCase().replace(/[\n\r\t]/g, " ") + " ";

        // 1. Skill Match Analysis
        let matchedSkills = [];
        let missingSkills = [];

        const getBaseSkill = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const uniqueTargetSkills = targetSkills.filter((v, i, a) => a.findIndex(t => getBaseSkill(t) === getBaseSkill(v)) === i);

        uniqueTargetSkills.forEach(skill => {
            const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?:^|[\\s\\W])${escapedSkill.replace('\\.', '\\.?')}(?:$|[\\s\\W])`, 'i');
            
            if (regex.test(normalizedText)) {
                matchedSkills.push(skill);
            } else {
                missingSkills.push(skill);
            }
        });

        score = uniqueTargetSkills.length > 0 ? (matchedSkills.length / uniqueTargetSkills.length) * 100 : 0;

        missingSkillsContainer.innerHTML = '';
        noMissingMsg.classList.add('hidden');

        const createSkillSection = (title, skills, isMatched) => {
            if (skills.length === 0) return;
            const header = document.createElement('h3');
            header.textContent = title;
            header.style.color = isMatched ? "var(--success)" : "var(--danger)";
            header.style.fontSize = "0.9rem";
            header.style.margin = "0.5rem 0";
            missingSkillsContainer.appendChild(header);

            const div = document.createElement('div');
            div.className = 'tags-container';
            skills.forEach(skill => {
                const span = document.createElement('span');
                span.className = 'skill-tag';
                if (isMatched) {
                    span.style.borderColor = "var(--success)";
                    span.style.color = "var(--success)";
                    span.style.background = "rgba(16, 185, 129, 0.05)";
                }
                span.textContent = skill.toUpperCase();
                div.appendChild(span);
            });
            missingSkillsContainer.appendChild(div);
        };

        createSkillSection("Matched Skills", matchedSkills, true);
        createSkillSection("Missing Skills", missingSkills, false);

        if (missingSkills.length === 0) {
            noMissingMsg.classList.remove('hidden');
        } else {
            suggestions.push({ 
                type: 'critical', 
                text: `Missing ${missingSkills.length} key keywords. Add ${missingSkills.slice(0, 2).join(' & ').toUpperCase()} to passing.`, 
                icon: '⚠️' 
            });
        }

        const hasExp = /\b(experience|history|employment)\b/i.test(normalizedText);
        const hasProj = /\b(projects|built|developed)\b/i.test(normalizedText);
        if (!hasExp) suggestions.push({ type: 'critical', text: 'Label work history clearly.', icon: '💼' });
        if (!hasProj) suggestions.push({ type: 'warning', text: 'Add a projects section.', icon: '🚀' });
        
        suggestions.push({ type: 'positive', text: 'Clean single-column layout is best.', icon: '🤖' });
        suggestions = suggestions.slice(0, 5);
        score = Math.round(score);

        const improvedText = generateImprovedResume(resumeText, missingSkills, targetSkills);
        document.getElementById("improvedResume").innerText = improvedText;

        lastMissingSkills = missingSkills;
        displayResults(score, suggestions);
        
        const boostBtn = Array.from(document.querySelectorAll('.primary-btn')).find(b => b.innerText.includes('Boost My Resume'));
        if (boostBtn) {
            boostBtn.onclick = boostResume;
        }
    }

    function boostResume() {
        const scoreElement = document.getElementById("score-number");
        const resumeBox = document.getElementById("improvedResume");
        const role = document.getElementById("job-role").value;

        if (improvedResumeCard) {
            improvedResumeCard.style.display = "block";
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (boosted) {
            resumeBox.innerText = "";
        }

        let updatedResume = originalResume;

        // Add missing skills if "Skills" section exists
        if (updatedResume.includes("Skills")) {
            updatedResume = updatedResume.replace(
                "Skills",
                "Skills\n• React\n• Node.js\n• Docker"
            );
        }

        // Improve summary
        if (updatedResume.includes("Summary")) {
            updatedResume = updatedResume.replace(
                "Summary",
                "Summary\nHighly motivated candidate with strong technical skills and problem-solving ability."
            );
        }

        // Add projects if missing
        if (!updatedResume.includes("Projects")) {
            updatedResume += "\n\nPROJECTS\n• Built real-world application based on role";
        }

        // Role-based keywords
        let roleLabel = "";
        let keywords = "";
        if (role === "java") {
            roleLabel = "Java Developer";
            keywords = "Spring Boot, Hibernate, REST API";
        } else if (role === "frontend") {
            roleLabel = "Frontend Developer";
            keywords = "React, JavaScript, Responsive Design";
        } else if (role === "fullstack") {
            roleLabel = "Full Stack Developer";
            keywords = "MERN Stack, Express, Database Design";
        }

        if (keywords) {
            updatedResume += "\n\nKEYWORDS ADDED:\n" + keywords;
        }

        updatedResume += "\n\n[ADDED CONTENT]\n• React\n• Node.js";

        resumeBox.innerText = updatedResume;

        let currentScore = parseInt(scoreElement.innerText) || 0;
        let targetScore = 100;
        let count = currentScore;

        let interval = setInterval(() => {
            if (count >= targetScore) {
                clearInterval(interval);
            } else {
                count++;
                scoreElement.innerText = count;
                const offset = CIRCLE_CIRCUMFERENCE - (count / 100) * CIRCLE_CIRCUMFERENCE;
                if (scoreProgress) scoreProgress.style.strokeDashoffset = offset;
                updateScoreStyles(count);
            }
        }, 20);

        boosted = true;
        
        // Update button text
        const boostBtn = Array.from(document.querySelectorAll('.primary-btn')).find(b => b.innerText.includes('Boost My Resume') || b.innerText.includes('Resume Boosted'));
        if (boostBtn) {
            boostBtn.innerText = "Resume Boosted ✅";
            boostBtn.disabled = true;
        }
    }

    function generateImprovedResume(originalText, missingSkills, roleSkills) {
        if (missingSkills.length === 0) return originalText;
        const skillsHeader = "RECOGNIZED SKILLS & EXPERTISE";
        const skillsList = missingSkills.map(s => s.toUpperCase()).join(", ");
        const skillsSectionRegex = /\b(SKILLS|CORE COMPETENCIES|TECHNICAL SKILLS|EXPERTISE)\b/i;
        
        if (skillsSectionRegex.test(originalText)) {
            return originalText.replace(skillsSectionRegex, (match) => `${match}\n${skillsList}, `);
        } else {
            return `${skillsHeader}\n${skillsList}\n\n${originalText}`;
        }
    }

    function displayResults(score, suggestions) {
        resultsSection.classList.remove('hidden');
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            animateScore(score);
        }, 50);

        suggestionsList.innerHTML = '';
        suggestions.forEach(sugg => {
            const li = document.createElement('li');
            li.className = `suggestion-item ${sugg.type}`;
            li.innerHTML = `<span class="suggestion-icon">${sugg.icon}</span><span>${sugg.text}</span>`;
            suggestionsList.appendChild(li);
        });
    }

    function animateScore(targetScore) {
        let currentScore = 0;
        const duration = 1200;
        const steps = 60;
        const stepTime = duration / steps;
        const increment = targetScore / steps;

        const timer = setInterval(() => {
            currentScore += increment;
            if (currentScore >= targetScore) {
                currentScore = targetScore;
                clearInterval(timer);
            }
            scoreNumber.textContent = Math.round(currentScore);
            const offset = CIRCLE_CIRCUMFERENCE - (currentScore / 100) * CIRCLE_CIRCUMFERENCE;
            if (scoreProgress) scoreProgress.style.strokeDashoffset = offset;
            updateScoreStyles(currentScore);
        }, stepTime);
    }

    function updateScoreStyles(score) {
        let label;
        if (score >= 80) label = 'Strong Match';
        else if (score >= 60) label = 'Good Match';
        else label = 'Needs Improvement';
        
        if (scoreLabel) scoreLabel.textContent = label;
        if (scoreLabel) scoreLabel.style.color = score >= 80 ? 'var(--success)' : (score >= 60 ? 'var(--warning)' : 'var(--danger)');
        if (scoreProgress) scoreProgress.style.stroke = score >= 80 ? 'var(--success)' : (score >= 60 ? 'var(--warning)' : 'var(--danger)');
    }
});

/**
 * Provides project suggestions based on the selected role
 * Matches internal role IDs (java, frontend, fullstack) to professional labels
 */
function getProjectSuggestions(role) {
    if (role === "java" || role === "Java Developer") {
        return [
            "Build a Spring Boot REST API for expense tracking",
            "Develop a microservices-based e-commerce backend",
            "Create a secure authentication system using JWT"
        ];
    }
    else if (role === "frontend" || role === "Frontend Developer") {
        return [
            "Build a responsive portfolio using React",
            "Create a dashboard with charts using Chart.js",
            "Develop a real-time chat UI"
        ];
    }
    else if (role === "fullstack" || role === "Full Stack Developer") {
        return [
            "Build a MERN stack project (blog or expense tracker)",
            "Create a full-stack authentication system",
            "Develop a job portal web app"
        ];
    }
    else {
        return [
            "Build a real-world project related to your field",
            "Create a portfolio website",
            "Solve real-world problem using tech"
        ];
    }
}

// Apply theme on load
window.addEventListener("DOMContentLoaded", function () {
    let theme = localStorage.getItem("theme");

    if (!theme) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) themeBtn.textContent = '🌙';
    } else if (theme === "dark") {
        document.body.classList.add("dark-mode");
        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) themeBtn.textContent = '🌙';
    } else {
        document.body.classList.remove("dark-mode");
        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) themeBtn.textContent = '🌞';
    }
});

// Toggle button function
function toggleTheme() {
    const isDark = document.body.classList.toggle("dark-mode");

    if (isDark) {
        localStorage.setItem("theme", "dark");
    } else {
        localStorage.setItem("theme", "light");
    }
    
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
        themeBtn.textContent = isDark ? '🌙' : '🌞';
    }
}
