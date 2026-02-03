// divide.js
// Coffee Divide Calculator Script

document.addEventListener('DOMContentLoaded', function() {
    const totalGramsInput = document.getElementById('totalGrams');
    const sizeInputs = [
        document.getElementById('size1'),
        document.getElementById('size2'),
        document.getElementById('size3'),
        document.getElementById('size4'),
        document.getElementById('size5')
    ];
    const requiredSizeSelect = document.getElementById('requiredSize');
    const calculateButton = document.getElementById('calculate');
    const bestValueDiv = document.getElementById('bestValue');
    const bestSolutionsDiv = document.getElementById('bestSolutions');
    const calcStepsDiv = document.getElementById('calcSteps');

    // Function to update select options text based on current size inputs
    function updateSelectOptions() {
        // Clear existing options except the first ("无")
        while (requiredSizeSelect.options.length > 1) {
            requiredSizeSelect.remove(1);
        }
        // Add options for sizes > 0
        sizeInputs.forEach((input, index) => {
            const val = input.value.trim();
            const size = val === "" ? 0 : parseFloat(val) || 0;
            if (size > 0) {
                const option = document.createElement('option');
                option.value = `size${index+1}`;
                option.textContent = `size${index+1} (${size}g)`;
                requiredSizeSelect.appendChild(option);
            }
        });
    }

    // Initial update
    updateSelectOptions();

    // Function to generate a unique key for a solution based on non-zero sizes
    function formatKey(sol, sizes) {
        let parts = [];
        for (let i = 0; i < sol.length; i++) {
            if (sol[i] > 0 && sizes[i] > 0) {
                parts.push(`${sizes[i]}g:${sol[i]}`);
            }
        }
        return parts.sort().join(',');
    }

    // Function to format a solution
    function formatSolution(sol, sizes) {
        let result = [];
        for (let i = 0; i < sol.length; i++) {
            if (sol[i] > 0 && sizes[i] > 0) {
                result.push(`${sizes[i]}g: ${sol[i]} 包<br>`);
            }
        }
        return result.join('');
    }

    calculateButton.addEventListener('click', function() {
        const totalGrams = parseFloat(totalGramsInput.value);
        if (isNaN(totalGrams) || totalGrams <= 0) {
            alert('请输入有效的总克数');
            return;
        }

        const sizes = sizeInputs.map(input => {
            const val = input.value.trim();
            if (val === "") return 0;
            const num = parseFloat(val);
            if (isNaN(num)) return NaN;
            return num;
        });
        if (sizes.some(isNaN)) {
            alert('请输入有效的分装大小');
            return;
        }

        const requiredSize = requiredSizeSelect.value;

        let bestValue = -1;
        let bestSolutions = [];
        let uniqueKeys = new Set();

        for (let a = 1; a < 10; a++) {
            for (let b = 0; b < 10; b++) {
                for (let c = 0; c < 10; c++) {
                    for (let d = 0; d < 10; d++) {
                        for (let e = 0; e < 10; e++) {
                            // Check required size
                            if (requiredSize === 'size1' && a < 1) continue;
                            if (requiredSize === 'size2' && b < 1) continue;
                            if (requiredSize === 'size3' && c < 1) continue;
                            if (requiredSize === 'size4' && d < 1) continue;
                            if (requiredSize === 'size5' && e < 1) continue;

                            // Note: Original code had if (b + c <= 0) continue; but since b,c >=0, only when b=c=0
                            // Assuming it's a mistake, perhaps meant b + c > 0 or something, but to match, we skip if b+c <=0
                            if (b + c <= 0) {
                                continue;
                            }

                            const value = a * sizes[0] + b * sizes[1] + c * sizes[2] + d * sizes[3] + e * sizes[4];
                            if (value <= totalGrams) {
                                const key = formatKey([a, b, c, d, e], sizes);
                                if (value > bestValue) {
                                    bestValue = value;
                                    bestSolutions = [[a, b, c, d, e]];
                                    uniqueKeys = new Set([key]);
                                } else if (value === bestValue) {
                                    if (!uniqueKeys.has(key)) {
                                        uniqueKeys.add(key);
                                        bestSolutions.push([a, b, c, d, e]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        bestValueDiv.textContent = bestValue.toFixed(1);
        bestSolutionsDiv.innerHTML = bestSolutions.map(sol => formatSolution(sol, sizes)).join('<br>') + `<br>剩余 ${(totalGrams - bestValue).toFixed(1)} 克`;

        calcStepsDiv.textContent = `计算完成。最佳值: ${bestValue.toFixed(1)}, 解决方案数量: ${bestSolutions.length}`;
    });

    // Update on input change or blur
    sizeInputs.forEach(input => {
        input.addEventListener('input', updateSelectOptions);
        input.addEventListener('blur', updateSelectOptions);
    });
});
