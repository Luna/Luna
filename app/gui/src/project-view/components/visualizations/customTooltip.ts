import { ITooltipComp, ITooltipParams } from '@ag-grid-community/core';

export class CustomTooltip implements ITooltipComp {
    eGui: HTMLElement;

    init(params: ITooltipParams & { numberOfNothing: number, numberOfWhitespace: number, total: number, hideDataQuality: boolean }) {
        this.eGui = document.createElement('div');

        // Tooltip styling
        Object.assign(this.eGui.style, {
            backgroundColor: '#f5f5f5',
            border: '1px solid #c0c0c0',
            padding: '10px',
            boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
            borderRadius: '4px',
            fontFamily: 'Arial, sans-serif',
            color: '#333'
        });

        // Helper functions
        const getPercentage = (value: number) => ((value / params.total) * 100).toFixed(2);
        const getVisibility = (value: number) => (value > 0 ? 'visible' : 'hidden');
        const createIndicator = (value: number) => {
            const color = value < 33 ? 'green' : value < 66 ? 'orange' : 'red';
            return `<div style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; margin-left: 5px;"></div>`;
        };

        // Data Quality HTML content
        const nothingPercent = getPercentage(params.numberOfNothing);
        const whitespacePercent = getPercentage(params.numberOfWhitespace);
        const dataQualityHtml = `
            <div style="visibility: ${getVisibility(params.numberOfNothing)};">
                Nulls/Nothing: ${nothingPercent}% ${createIndicator(+nothingPercent)}
            </div>
            <div style="visibility: ${getVisibility(params.numberOfWhitespace)};">
                Trailing/Leading Whitespace: ${whitespacePercent}% ${createIndicator(+whitespacePercent)}
            </div>
        `;

        // Render Tooltip HTML
        this.eGui.innerHTML = `
            <div><b>Column value type:</b> ${params.value}</div>
            <div style="display: ${params.hideDataQuality ? 'none' : 'block'};"">
                <b>Data Quality Indicators</b>
                ${dataQualityHtml}
            </div>
        `;
    }

    getGui() {
        return this.eGui;
    }
}
