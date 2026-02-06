'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogEvent } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';

function parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    // Matches DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm
    let parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}):(\d{2}):?(\d{2})?/);
    if (parts) {
        const [, day, month, year, hour, minute, second] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), second ? parseInt(second) : 0);
    }

    // Matches DD/MM/YYYY
    parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
        const [, day, month, year] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    return null;
}

interface EventLogTableProps {
    events: LogEvent[] | undefined;
}

export default function EventLogTable({ events }: EventLogTableProps) {
  const { t } = useI18n();

  const processedEvents = React.useMemo(() => {
    if (!events || events.length === 0) {
      return [];
    }

    // 1. Parse and sort all events.
    const allParsedEvents = events
      .map(e => ({
        ...e,
        startDateObj: parseDate(e.startDate),
        endDateObj: parseDate(e.endDate),
      }))
      .filter((e): e is LogEvent & { startDateObj: Date; endDateObj: Date | null } => !!e.startDateObj)
      .sort((a, b) => a.startDateObj.getTime() - b.startDateObj.getTime());

    const eventsWithMetrics: (LogEvent & { timeToRepair?: number, timeBetweenFailures?: number })[] = [];
    let lastFailureEndDate: Date | null = null;
    
    for (const event of allParsedEvents) {
        const newEvent: LogEvent & { timeToRepair?: number, timeBetweenFailures?: number } = { ...event };

        // Calculate Time to Repair (TR)
        if (event.endDateObj && event.startDateObj) {
            const diffHours = (event.endDateObj.getTime() - event.startDateObj.getTime()) / (1000 * 60 * 60);
            newEvent.timeToRepair = diffHours === 0 ? 24 : diffHours;
        }

        // Calculate Time Between Failures (TEF)
        if (event.status === 'FALHA') {
            if (lastFailureEndDate) {
                const tefHours = (event.startDateObj.getTime() - lastFailureEndDate.getTime()) / (1000 * 60 * 60);
                if(tefHours > 0) {
                    newEvent.timeBetweenFailures = tefHours;
                }
            }
            lastFailureEndDate = event.endDateObj;
        }
        
        eventsWithMetrics.push(newEvent);
    }
    
    return eventsWithMetrics;
}, [events]);


  if (!events || events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('assetDetail.eventLog.title')}</CardTitle>
        <CardDescription>{t('assetDetail.eventLog.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                <TableHead>{t('assetDetail.eventLog.tag')}</TableHead>
                <TableHead>{t('assetDetail.eventLog.startDate')}</TableHead>
                <TableHead>{t('assetDetail.eventLog.endDate')}</TableHead>
                <TableHead>{t('assetDetail.eventLog.descriptionLabel')}</TableHead>
                <TableHead className="text-right">{t('assetDetail.eventLog.tef')}</TableHead>
                <TableHead className="text-right">{t('assetDetail.eventLog.tr')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedEvents.map((event, index) => (
                <TableRow key={index}>
                  <TableCell>{event.tag}</TableCell>
                  <TableCell>{event.startDate}</TableCell>
                  <TableCell>{event.endDate}</TableCell>
                  <TableCell>{event.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {event.timeBetweenFailures !== undefined && event.timeBetweenFailures > 0 ? event.timeBetweenFailures.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {event.timeToRepair !== undefined ? event.timeToRepair.toFixed(2) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
