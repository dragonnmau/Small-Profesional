import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'serviceList'
})
export class ServiceListPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}
