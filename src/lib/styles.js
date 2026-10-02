import css from '../styles.css';

export function injectStyles() {
        if (document.getElementById('bte-styles')) {
            return;
        } 

        const style = document.createElement('style');
        style.id = 'bte-styles';
        style.textContent = css;
        document.head.appendChild(style);
}