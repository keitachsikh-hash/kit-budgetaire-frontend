import { Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-chart',
  template: `<div class="position-relative" [style.height.px]="height()"><canvas #canvas></canvas></div>`,
})
export class ChartComponent implements OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  readonly height = input(260);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const config = this.config();
      this.chart?.destroy();
      const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
      Chart.defaults.color = dark ? '#cfd8d3' : '#41504a';
      Chart.defaults.borderColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
      this.chart = new Chart(this.canvas().nativeElement, {
        ...config,
        options: { responsive: true, maintainAspectRatio: false, ...config.options },
      });
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
