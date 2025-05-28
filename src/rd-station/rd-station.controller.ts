import { Controller, Post, Put, Get, Body, Param, Query } from '@nestjs/common';
import { RdStationService } from './rd-station.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateOrganizationDto,
  CreateContactDto,
  UpdateContactDto,
} from './dto';

@Controller('rdstation')
export class RdStationController {
  constructor(private readonly rdStationService: RdStationService) {}

  @Post('produtos')
  async createProduct(@Body() product: CreateProductDto) {
    return this.rdStationService.createProduct(product);
  }

  @Put('produtos/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() product: UpdateProductDto,
  ) {
    return this.rdStationService.updateProduct(id, product);
  }

  @Post('empresas')
  async createOrganization(@Body() org: CreateOrganizationDto) {
    return this.rdStationService.createOrganization(org);
  }

  @Post('contato')
  async createContact(@Body() contact: CreateContactDto) {
    return this.rdStationService.createContact(contact);
  }

  @Get('contato')
  async getContact(@Query('email') email: string) {
    return this.rdStationService.getContact(email);
  }

  @Put('contato/:id')
  async updateContact(
    @Param('id') id: string,
    @Body() contact: UpdateContactDto,
  ) {
    return this.rdStationService.updateContact(id, contact);
  }
}
