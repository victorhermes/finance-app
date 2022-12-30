import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment, { months } from 'moment';
import { Avatar, Divider, FlatList, HStack, Icon, Select, Spacer, Text, VStack } from 'native-base';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ListRenderItemInfo, RefreshControl } from 'react-native';
import usePluggyService from '../../hooks/pluggyService';
import { Account, Transaction } from '../../services/pluggy';
import { ItemsAsyncStorageKey } from '../../utils/contants';
import { formatMoney } from '../../utils/money';
import { capitalize } from '../../utils/text';

import { Container } from './styles';

const currentMonthNumber = moment().format('MM');

const Transactions: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState([] as Transaction[]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNumber);

  const pluggyService = usePluggyService();

  const previousDate = useRef(moment(0));

  const totalIncomes = transactions.reduce(
    (total, transaction) => (transaction.type === 'CREDIT' ? total + transaction.amount : total),
    0,
  );

  const totalExpenses = transactions.reduce(
    (total, transaction) => (transaction.type === 'DEBIT' ? total - transaction.amount : total),
    0,
  );

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);

    const itemsId: string[] = JSON.parse(
      (await AsyncStorage.getItem(ItemsAsyncStorageKey)) || '[]',
    );

    const accountPromiseResults = await Promise.all(
      itemsId.map((id) => pluggyService.fetchAccounts(id)),
    );

    const accounts = accountPromiseResults.reduce(
      (list, item) => [...list, ...item.results],
      [] as Account[],
    );

    const startDate = moment(selectedMonth, 'MM').startOf('month');
    const endDate = moment(selectedMonth, 'MM').endOf('month');

    const promiseResults = await Promise.all(
      accounts.map(({ id }) =>
        pluggyService.fetchTransactions(id, {
          pageSize: 500,
          from: startDate.format('YYYY-MM-DD'),
          to: endDate.format('YYYY-MM-DD'),
        }),
      ),
    );

    const transactionsList = promiseResults
      .reduce((list, item) => [...list, ...item.results], [] as Transaction[])
      .filter((item) => item.description !== 'Dinheiro guardado')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setTransactions(transactionsList);
    setIsLoading(false);
  }, [pluggyService, selectedMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const listHeaderComponent = useCallback(
    () => (
      <HStack space={3} marginY={3}>
        <Select
          flexGrow={1}
          selectedValue={selectedMonth}
          borderRadius={100}
          onValueChange={(value) => setSelectedMonth(value)}
          fontSize="md"
        >
          {months().map((month, index) => (
            <Select.Item key={index} label={capitalize(month)} value={(index + 1).toString()} />
          ))}
        </Select>
        <VStack>
          <Text>Renda</Text>
          <Text>R$ {formatMoney({ value: totalIncomes })}</Text>
        </VStack>
        <VStack>
          <Text>Gasto</Text>
          <Text>R$ {formatMoney({ value: totalExpenses })}</Text>
        </VStack>
      </HStack>
    ),
    [selectedMonth, totalExpenses, totalIncomes],
  );

  const transactionsListSeparator = useCallback((transaction: Transaction, index: number) => {
    const date = moment(transaction.date).startOf('day');

    const component =
      index === 0 || date.isAfter(previousDate.current, 'day') ? (
        <HStack space={3} alignItems="center">
          <VStack alignItems="center">
            <Text fontWeight="bold" fontSize="xl" color="coolGray.400">
              {date.format('DD')}
            </Text>
            <Text textTransform="uppercase" fontWeight="light" color="coolGray.400">
              {date.format('MMM')}
            </Text>
          </VStack>
          <Divider />
        </HStack>
      ) : (
        <></>
      );

    previousDate.current = date;

    return component;
  }, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Transaction>) => (
      <>
        {transactionsListSeparator(item, index)}
        <HStack paddingY={3} alignItems="center" space={3}>
          <Avatar
            backgroundColor="transparent"
            borderStyle="solid"
            borderColor="coolGray.500"
            borderWidth="1"
          >
            <Icon
              as={MaterialIcons}
              name={item.type == 'DEBIT' ? 'shopping-cart' : 'attach-money'}
              size="md"
            />
          </Avatar>
          <VStack flexShrink={1}>
            {item.category && <Text fontWeight="thin">{item.category}</Text>}
            <Text isTruncated>{item.description}</Text>
          </VStack>
          <Spacer />
          <Text fontWeight="bold">
            {item.type === 'DEBIT' ? '-' : ''}R${' '}
            {formatMoney({ value: item.amount, absolute: true })}
          </Text>
        </HStack>
      </>
    ),
    [transactionsListSeparator],
  );

  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  return (
    <Container>
      <FlatList
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchTransactions} />}
        ListHeaderComponent={listHeaderComponent}
        data={transactions}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        paddingX={3}
      />
    </Container>
  );
};

export default Transactions;
