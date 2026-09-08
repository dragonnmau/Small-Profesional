import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Db, TaxSettings } from '../../../services/db';

@Component({
  selector: 'app-calculo-impuestos',
  imports: [FormsModule, CurrencyPipe, NgIf],
  templateUrl: './calculo-impuestos.html',
  styleUrl: './calculo-impuestos.scss'
})
export class CalculoImpuestos implements OnInit {
  settings: TaxSettings = { ivaRate: 16, isrRate: 30 };
  moralBase = 0;
  moralIvaRetention = 0;
  moralIsrRetention = 0;
  fisicaCost = 0;
  fisicaTotal = 0;
  saved = false;

  constructor(private readonly db: Db) {}

  ngOnInit(): void {
    this.settings = this.db.getTaxSettings();
  }

  saveSettings(): void {
    this.settings = {
      ivaRate: this.clampRate(this.settings.ivaRate),
      isrRate: this.clampRate(this.settings.isrRate)
    };
    this.settings = this.db.updateTaxSettings(this.settings);
    this.saved = true;
    setTimeout(() => this.saved = false, 2500);
  }

  get moralIva(): number {
    return this.moralBase * this.settings.ivaRate / 100;
  }

  get moralTotal(): number {
    return this.moralBase + this.moralIva - this.moralIvaRetention - this.moralIsrRetention;
  }

  get fisicaIvaAdded(): number {
    return this.fisicaCost * this.settings.ivaRate / 100;
  }

  get fisicaTotalAdded(): number {
    return this.fisicaCost + this.fisicaIvaAdded;
  }

  get fisicaBaseFromTotal(): number {
    return this.fisicaTotal / (1 + this.settings.ivaRate / 100);
  }

  get fisicaIvaFromTotal(): number {
    return this.fisicaTotal - this.fisicaBaseFromTotal;
  }

  private clampRate(rate: number): number {
    return Math.min(100, Math.max(0, Number(rate) || 0));
  }

}
