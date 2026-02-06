'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { LogEvent } from '@/lib/types';
import { useI18n } from '@/i18n/i18n-provider';

function parseDate(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    let parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
    if (parts) {
        const [, day, month, year, hour, minute] = parts;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
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

    // 1. Parse dates and sort all events chronologically
    const allParsedEvents = events
      .map((e) => ({ ...e, startDateObj: parseDate(e.startDate), endDateObj: parseDate(e.endDate) }))
      .filter((e): e is LogEvent & { startDateObj: Date; endDateObj: Date | null } => !!e.startDateObj)
      .sort((a, b) => a.startDateObj!.getTime() - b.startDateObj!.getTime());

    // 2. Isolate only the failure events to calculate TEF against
    const failureEventsOnly = allParsedEvents.filter(e => e.status === 'FALHA');

    // 3. Map through all events to calculate metrics
    return allParsedEvents.map((event) => {
      // Calculate Time to Repair (TR)
      let timeToRepair: number | undefined;
      if (event.endDateObj && event.startDateObj) {
        const diffHours = (event.endDateObj.getTime() - event.startDateObj.getTime()) / (1000 * 60 * 60);
        // An event on the same day with same start/end time (or no time) is considered a full day (24h)
        timeToRepair = diffHours === 0 ? 24 : diffHours;
      }

      // Calculate Time Between Failures (TEF)
      let timeBetweenFailures: number | undefined;
      if (event.status === 'FALHA') {
        const currentFailureIndex = failureEventsOnly.findIndex(fe => fe === event);
        
        if (currentFailureIndex > 0) {
          const previousFailureEvent = failureEventsOnly[currentFailureIndex - 1];
          if (previousFailureEvent.endDateObj) {
            timeBetweenFailures = (event.startDateObj.getTime() - previousFailureEvent.endDateObj.getTime()) / (1000 * 60 * 60);
          }
        }
      }

      return { ...event, timeToRepair, timeBetweenFailures };
    });
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
