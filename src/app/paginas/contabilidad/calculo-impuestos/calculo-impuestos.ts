import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Db, TaxSettings } from '../../../services/db';
import { calculateRetention, IvaRetention, RETENTION_PROFILES } from './retention-calculator';

@Component({
  selector: 'app-calculo-impuestos',
  imports: [FormsModule, CurrencyPipe, NgIf, NgFor],
  templateUrl: './calculo-impuestos.html',
  styleUrl: './calculo-impuestos.scss'
})
export class CalculoImpuestos implements OnInit {
  settings: TaxSettings = { ivaRate: 16, isrRate: 30 };
  moralBase = 0;
  readonly profiles = RETENTION_PROFILES;
  profileId = 'honorarios';
  calculationMode: 'subtotal' | 'net' = 'subtotal';
  retentionIvaRate = 16;
  retentionIsrRate = 10;
  ivaRetention: IvaRetention = 'two-thirds';
  decimals = 2;
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

  applyProfile(): void {
    const profile = this.profiles.find(item => item.id === this.profileId);
    if (!profile) return;
    this.retentionIvaRate = 16;
    this.retentionIsrRate = profile.isrRate;
    this.ivaRetention = profile.ivaRetention;
  }

  useCustomRates(): void { this.profileId = 'custom'; }
  get profileNote(): string {
    return this.profiles.find(item => item.id === this.profileId)?.note || 'Configura las tasas que correspondan al emisor y a la operación. La retención de ISR se calcula sobre el subtotal sin IVA.';
  }
  get digitsInfo(): string { return `1.${this.decimals}-${this.decimals}`; }
  get retentionCalculation() {
    try {
      return { result: calculateRetention({ amount: this.moralBase, mode: this.calculationMode,
        ivaRate: this.retentionIvaRate, isrRate: this.retentionIsrRate, ivaRetention: this.ivaRetention, decimals: this.decimals }), error: '' };
    } catch (error) { return { result: null, error: error instanceof Error ? error.message : 'Revisa los datos del cálculo.' }; }
  }
  get ivaRetentionLabel(): string {
    if (!this.retentionIvaRate || this.ivaRetention === 'none') return 'Sin retención de IVA';
    return this.ivaRetention === 'two-thirds' ? 'Retención de IVA (⅔ del IVA)' : 'Retención de IVA (4% del subtotal)';
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
